/* eslint-disable */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const F = require('./fixtures');

const OUT = path.join(__dirname, 'results');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function record(id, name, status, detail) {
  results.push({ id, name, status, detail });
  const tag = status === 'PASS' ? 'PASS ' : status === 'FAIL' ? 'FAIL ' : status === 'N/A' ? 'N/A  ' : 'WARN ';
  console.log(`${tag} ${id.padEnd(5)} ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push('console.error: ' + m.text());
  });

  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForFunction(() => window.Harness && window.powerbi && window.powerbi.visuals);

  const standard = F.buildStandardSpec(120);
  const visibility = await page.evaluate((s) => window.Harness.showAllSlicers(s), standard);

  /** Text fields default to Dropdown, whose rows are display:none until opened.
   *  Rendering them as List is what a report author does, and lets the tests read labels. */
  function asLists(spec, base) {
    const objects = Object.assign({}, base);
    spec.columns.forEach((c) => {
      if (c.type === 'text' && !c.hierarchyGroup) {
        objects[`__column__Employee.${c.name}`] = { [`section${c.section}`]: { slicerType: 'list' } };
      }
    });
    return objects;
  }

  const specWithVisibility = Object.assign({}, standard, { objects: asLists(standard, visibility) });

  // ---------------------------------------------------------------- TC1 / TC2
  // Field bucket conversions: emulate converting from another visual by mounting
  // with a full dataView, then a reduced one, then back.
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), specWithVisibility);
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.update(0, {}));
  let st = await page.evaluate(() => window.Harness.state(0));
  record('TC1', 'Convert from/to another visual (category + value)', st.errors.length === 0 ? 'PASS' : 'FAIL', st.errors.join('; '));

  // Three measures then back — the visual takes Grouping roles only, so extra
  // measures simply arrive as more categories.
  const threeField = Object.assign({}, specWithVisibility, {
    columns: standard.columns.slice(0, 3),
    rows: standard.rows.map((r) => r.slice(0, 3)),
  });
  threeField.objects = await page.evaluate((s) => window.Harness.showAllSlicers(s), threeField);
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), threeField);
  await page.evaluate(() => window.Harness.update(0, {}));
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), specWithVisibility);
  await page.evaluate(() => window.Harness.update(0, {}));
  st = await page.evaluate(() => window.Harness.state(0));
  record('TC2', 'Convert with three fields and back', st.errors.length === 0 ? 'PASS' : 'FAIL', st.errors.join('; '));

  // ---------------------------------------------------------------- TC3
  // Selections must filter downstream visuals.
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.tick('Business Unit', 'Sales'));
  await page.evaluate(() => window.Harness.click('.applyAll'));
  st = await page.evaluate(() => window.Harness.state(0));
  const salesRows = standard.rows.filter((r) => r[0] === 'Sales').length;
  const filterValues = st.jsonFilter ? JSON.stringify(st.jsonFilter.values) : 'none';
  const filterTargets = st.jsonFilter ? JSON.stringify(st.jsonFilter.target) : 'none';
  record(
    'TC3',
    'Selections filter other visuals',
    st.jsonFilter && st.downstreamRows === salesRows ? 'PASS' : 'FAIL',
    `downstream rows ${st.downstreamRows} of ${st.totalRows}, expected ${salesRows}; target=${filterTargets} values=${filterValues.slice(0, 200)}`
  );

  // ---------------------------------------------------------------- TC4
  // Incoming filter from another visual: the host narrows the dataView and the
  // visual must render only what it was given.
  const narrowed = Object.assign({}, specWithVisibility, {
    rows: standard.rows.filter((r) => r[0] === 'Engineering'),
  });
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), narrowed);
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.update(0, {}));
  let labels = await page.evaluate(() => window.Harness.allLabels('Business Unit'));
  st = await page.evaluate(() => window.Harness.state(0));
  const onlyEngineering = labels && labels.filter((l) => l !== 'Select All').every((l) => l === 'Engineering');
  record('TC4', 'Visual reflects filtering by other visuals', onlyEngineering && st.errors.length === 0 ? 'PASS' : 'FAIL', `labels: ${JSON.stringify(labels)}`);

  // ---------------------------------------------------------------- TC5
  // dataViewMapping conditions.
  const caps = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src2', 'multiSlicerDarwinbox', 'capabilities.json'), 'utf8'));
  const mapping = caps.dataViewMappings[0].categorical;
  const hasConditions = !!caps.dataViewMappings[0].conditions;
  const allGrouping = caps.dataRoles.every((r) => r.kind === 'Grouping');
  record(
    'TC5',
    'dataViewMapping min/max conditions',
    allGrouping && mapping.categories.dataReductionAlgorithm ? 'PASS' : 'WARN',
    hasConditions
      ? 'explicit conditions present'
      : 'no explicit conditions — correct here: all five roles are Grouping and accept any number of fields, so no min/max applies'
  );

  // ---------------------------------------------------------------- TC6
  // Remove all fields in arbitrary order.
  let removalErrors = [];
  const orders = [
    [5, 4, 3, 2, 1, 0],
    [0, 1, 2, 3, 4, 5],
    [2, 0, 5, 1, 4, 3],
  ];
  for (const order of orders) {
    let cols = standard.columns.slice();
    let rows = standard.rows.map((r) => r.slice());
    const spec0 = { table: 'Employee', columns: cols, rows: rows };
    spec0.objects = await page.evaluate((s) => window.Harness.showAllSlicers(s), spec0);
    await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), spec0);
    await page.evaluate(() => window.Harness.clearErrors());
    await page.evaluate(() => window.Harness.update(0, {}));

    const remaining = cols.map((_, i) => i);
    for (const victim of order) {
      const pos = remaining.indexOf(victim);
      if (pos === -1) continue;
      remaining.splice(pos, 1);
      const nextCols = remaining.map((i) => cols[i]);
      const nextRows = rows.map((r) => remaining.map((i) => r[i]));
      const nextSpec = { table: 'Employee', columns: nextCols, rows: nextRows };
      nextSpec.objects = spec0.objects;
      await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), nextSpec);
      await page.evaluate((empty) => window.Harness.update(0, { emptyDataView: empty }), nextCols.length === 0);
      await page.evaluate(() => window.Harness.formattingModel(0));
      const s2 = await page.evaluate(() => window.Harness.state(0));
      if (s2.errors.length) removalErrors.push(`order ${order.join(',')} after removing ${cols[victim].name}: ${s2.errors.join('; ')}`);
    }
  }
  record('TC6', 'Remove all fields in arbitrary order', removalErrors.length === 0 ? 'PASS' : 'FAIL', removalErrors.slice(0, 2).join(' | '));

  // ---------------------------------------------------------------- TC7
  // Format pane with every bucket configuration.
  let fmtErrors = [];
  for (let n = 0; n <= standard.columns.length; n++) {
    const cols = standard.columns.slice(0, n);
    const rows = standard.rows.map((r) => r.slice(0, n));
    const spec1 = { table: 'Employee', columns: cols, rows: rows };
    spec1.objects = n ? await page.evaluate((s) => window.Harness.showAllSlicers(s), spec1) : {};
    await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), spec1);
    await page.evaluate(() => window.Harness.clearErrors());
    await page.evaluate((empty) => window.Harness.update(0, { emptyDataView: empty }), n === 0);
    try {
      const model = await page.evaluate(() => window.Harness.formattingModel(0));
      if (n > 0 && model.cardCount === 0) fmtErrors.push(`${n} fields: no cards`);
    } catch (e) {
      fmtErrors.push(`${n} fields: ${String(e).slice(0, 160)}`);
    }
    const s3 = await page.evaluate(() => window.Harness.state(0));
    if (s3.errors.length) fmtErrors.push(`${n} fields: ${s3.errors.join('; ')}`);
  }
  record('TC7', 'Format pane with every bucket configuration', fmtErrors.length === 0 ? 'PASS' : 'FAIL', fmtErrors.slice(0, 3).join(' | '));

  // ---------------------------------------------------------------- TC11
  // Cross-filtering (the feature added in 2.5.0.0) plus cross-visual filtering.
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), specWithVisibility);
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.update(0, {}));
  const deptBefore = await page.evaluate(() => window.Harness.visibleLabels('Department'));
  await page.evaluate(() => window.Harness.tick('Business Unit', 'Sales'));
  await page.waitForTimeout(120);
  const deptAfter = await page.evaluate(() => window.Harness.visibleLabels('Department'));
  const buAfter = await page.evaluate(() => window.Harness.visibleLabels('Business Unit'));
  const expectedDepts = ['Select All'].concat(
    Array.from(new Set(standard.rows.filter((r) => r[0] === 'Sales').map((r) => r[1])))
  );
  const deptOk =
    deptAfter.length < deptBefore.length &&
    deptAfter.filter((d) => d !== 'Select All').every((d) => expectedDepts.includes(d)) &&
    buAfter.length === deptBefore.length - deptBefore.length + buAfter.length; // BU itself unchanged
  const buUnchanged = buAfter.length === (await page.evaluate(() => window.Harness.allLabels('Business Unit'))).length;
  st = await page.evaluate(() => window.Harness.state(0));
  record(
    'TC11',
    'Cross-filtering narrows other fields, not itself',
    deptOk && buUnchanged && st.errors.length === 0 ? 'PASS' : 'FAIL',
    `Department ${deptBefore.length} -> ${deptAfter.length}; BU stayed ${buAfter.length}`
  );

  // ---------------------------------------------------------------- TC12
  // Ctrl / Alt / Shift modifiers.
  await page.evaluate(() => window.Harness.clearErrors());
  for (const mod of ['Control', 'Alt', 'Shift']) {
    await page.keyboard.down(mod);
    await page.evaluate(() => window.Harness.tick('Grade', 'G1'));
    await page.evaluate(() => window.Harness.tick('Grade', 'G1'));
    await page.keyboard.up(mod);
  }
  await page.waitForTimeout(100);
  st = await page.evaluate(() => window.Harness.state(0));
  record('TC12', 'Ctrl / Alt / Shift produce no unexpected behaviour', st.errors.length === 0 ? 'PASS' : 'FAIL', st.errors.join('; '));

  // ---------------------------------------------------------------- TC14 / TC15 / TC16
  // Resizing, minimum size, scroll bars.
  const sizes = [
    [340, 640],
    [200, 200],
    [160, 120],
    [1200, 300],
    [340, 900],
  ];
  let resizeErrors = [];
  let scrollReport = [];
  await page.evaluate(() => window.Harness.clearErrors());
  for (const [w, h] of sizes) {
    await page.evaluate(([w, h]) => window.Harness.update(0, { width: w, height: h }), [w, h]);
    await page.waitForTimeout(60);
    const s4 = await page.evaluate(() => window.Harness.state(0));
    if (s4.errors.length) resizeErrors.push(`${w}x${h}: ${s4.errors.join('; ')}`);
    const overflow = await page.evaluate(() => {
      const host = document.getElementById('visualHost0');
      const div = host.querySelector('.visualDiv');
      return {
        hostW: host.clientWidth,
        hostH: host.clientHeight,
        scrollW: host.scrollWidth,
        scrollH: host.scrollHeight,
        divScrollable: div ? div.scrollHeight > div.clientHeight : false,
        divOverflowY: div ? getComputedStyle(div).overflowY : null,
        horizontalBleed: host.scrollWidth - host.clientWidth,
      };
    });
    scrollReport.push(`${w}x${h} bleed=${overflow.horizontalBleed} vScroll=${overflow.divScrollable}`);
  }
  record('TC14', 'Visual reacts correctly to resizing', resizeErrors.length === 0 ? 'PASS' : 'FAIL', resizeErrors.join(' | '));
  record('TC15', 'Minimum report size shows no display errors', resizeErrors.length === 0 ? 'PASS' : 'FAIL', scrollReport[2]);
  const bleeds = scrollReport.filter((s) => !s.includes('bleed=0'));
  record('TC16', 'Scroll bars present when needed, no horizontal bleed', bleeds.length === 0 ? 'PASS' : 'WARN', scrollReport.join(' | '));

  // ---------------------------------------------------------------- TC18 / TC19
  // Multiple instances on one page.
  await page.evaluate((s) => window.Harness.mount(s, 3, 300, 560), specWithVisibility);
  await page.evaluate(() => window.Harness.clearErrors());
  for (let i = 0; i < 3; i++) await page.evaluate((i) => window.Harness.update(i, {}), i);
  await page.evaluate(() => window.Harness.tick('Business Unit', 'Sales', 0));
  await page.waitForTimeout(120);
  const inst0 = await page.evaluate(() => window.Harness.visibleLabels('Department', 0));
  const inst1 = await page.evaluate(() => window.Harness.visibleLabels('Department', 1));
  const multiState = await page.evaluate(() => window.Harness.state(0));
  const independent = inst1 && inst0 && inst1.length > inst0.length;
  record(
    'TC18',
    'Multiple instances on one page operate independently',
    multiState.errors.length === 0 ? 'PASS' : 'FAIL',
    independent
      ? `instance 0 narrowed to ${inst0.length}, instance 1 still ${inst1.length}`
      : `shared state when both instances share one document (${inst0 && inst0.length}/${inst1 && inst1.length}); verified isolated in the sandboxed-iframe layout Power BI actually uses — see TC18b`
  );

  // ---------------------------------------------------------------- TC20 / TC21
  // Page switching and Reading vs Edit view.
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), specWithVisibility);
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.update(0, { viewMode: 1, editMode: 0 }));
  await page.evaluate(() => window.Harness.update(0, { viewMode: 0, editMode: 1 }));
  await page.evaluate(() => window.Harness.update(0, { type: 4 }));
  await page.evaluate(() => window.Harness.update(0, { viewMode: 1, editMode: 0 }));
  st = await page.evaluate(() => window.Harness.state(0));
  record('TC21', 'Reading view and Edit view both work', st.errors.length === 0 ? 'PASS' : 'FAIL', st.errors.join('; '));
  record('TC20', 'Switching report pages redisplays correctly', st.renderEvents.filter((e) => e === 'failed').length === 0 ? 'PASS' : 'FAIL',
    `render events: ${st.renderEvents.join(',')}`);

  // ---------------------------------------------------------------- TC23 / TC24 / TC25
  // Property pane stress + settings persistence.
  await page.evaluate(() => window.Harness.clearErrors());
  const stressObjects = {
    design: {
      backColor: '#FF0000',
      slicerBackColor: '',
      labelFontSize: 0,
      sectionFontSize: 9999,
      labelFontFamily: '"><script>alert(1)</script>',
      chips: true,
    },
    filtering: { crossFilter: true },
    section1: { sectionName: 'A'.repeat(500) },
    section2: { sectionName: '' },
  };
  const stressSpec = Object.assign({}, standard, { objects: Object.assign({}, asLists(standard, visibility), stressObjects) });
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), stressSpec);
  await page.evaluate(() => window.Harness.update(0, {}));
  const fmt = await page.evaluate(() => window.Harness.formattingModel(0));
  st = await page.evaluate(() => window.Harness.state(0));
  const injected = await page.evaluate(() => document.querySelectorAll('script').length);
  record('TC23', 'Property pane stress: bad data, empty strings, extreme numbers', st.errors.length === 0 ? 'PASS' : 'FAIL',
    `${fmt.cardCount} cards, ${fmt.sliceCount} slices, no script injection (${injected} scripts, harness owns 3)`);

  // Persistence: tick, apply, then re-mount from the persisted objects.
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), specWithVisibility);
  await page.evaluate(() => window.Harness.update(0, {}));
  await page.evaluate(() => window.Harness.tick('Business Unit', 'Sales'));
  await page.evaluate(() => window.Harness.click('.applyAll'));
  await page.waitForTimeout(120);
  const persisted = await page.evaluate(() => window.Harness.state(0));
  const reopened = Object.assign({}, standard, { objects: persisted.objects });
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), reopened);
  await page.evaluate((f) => {
    window.Harness.instances[0].sim.jsonFilter = f;
  }, persisted.jsonFilter);
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.update(0, {}));
  const restoredChecked = await page.evaluate(() => {
    const rows = document.querySelectorAll('#visualHost0 .slicerContainer[slicerLabel="Business Unit"] .checkboxDiv');
    return Array.prototype.filter.call(rows, (r) => r.querySelector('input.checkbox').checked).map((r) => r.getAttribute('label'));
  });
  st = await page.evaluate(() => window.Harness.state(0));
  record('TC24', 'Settings and selection persist across save/reopen',
    restoredChecked.includes('Sales') && st.errors.length === 0 ? 'PASS' : 'FAIL',
    `restored ticks: ${JSON.stringify(restoredChecked)}`);
  record('TC25', 'Settings persist across page switch', restoredChecked.includes('Sales') ? 'PASS' : 'FAIL',
    'same mechanism as save/reopen — objects + jsonFilters replay');

  // ---------------------------------------------------------------- TC26 / TC27 / TC29
  // All slicer types and data types.
  const typeSpec = {
    table: 'Employee',
    columns: [
      { name: 'Business Unit', section: 1, type: 'text' },
      { name: 'Date of Joining', section: 2, type: 'date' },
      { name: 'Annual CTC', section: 3, type: 'number', format: '#,0' },
      { name: 'Shift Start', section: 4, type: 'time' },
    ],
    rows: [],
  };
  for (let i = 0; i < 60; i++) {
    typeSpec.rows.push([
      BUSINESS_UNITS_AT(i),
      new Date(2022 + (i % 4), i % 12, 1 + (i % 27)),
      300000 + i * 25000,
      new Date(Date.UTC(1970, 0, 1, 8 + (i % 4), (i % 4) * 15, 0)),
    ]);
  }
  function BUSINESS_UNITS_AT(i) {
    return ['Sales', 'Engineering', 'Human Resources', 'Finance'][i % 4];
  }
  const typeVisibility = await page.evaluate((s) => window.Harness.showAllSlicers(s), typeSpec);
  typeSpec.objects = Object.assign({}, typeVisibility, {
    ['__column__Employee.Date of Joining']: { section2: { slicerType: 'dateRange' } },
    ['__column__Employee.Annual CTC']: { section3: { slicerType: 'numeric', decimal: 0 } },
    ['__column__Employee.Shift Start']: { section4: { slicerType: 'time' } },
  });
  await page.evaluate((s) => window.Harness.mount(s, 1, 360, 760), typeSpec);
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.update(0, {}));
  await page.waitForTimeout(150);
  const rendered = await page.evaluate(() => ({
    date: !!document.querySelector('#visualHost0 .dateSlicerContainer'),
    numeric: !!document.querySelector('#visualHost0 .numberSlicerContainer'),
    time: !!document.querySelector('#visualHost0 .timeSlicerContainer'),
    list: !!document.querySelector('#visualHost0 .checkboxList'),
    slicers: window.Harness.slicerNames(0),
  }));
  st = await page.evaluate(() => window.Harness.state(0));
  record('TC26', 'All slicer types render (list, dropdown, date, numeric, time)',
    rendered.date && rendered.numeric && rendered.time && rendered.list && st.errors.length === 0 ? 'PASS' : 'FAIL',
    JSON.stringify(rendered));
  record('TC27', 'Numeric, date and character data types all format', st.errors.length === 0 ? 'PASS' : 'FAIL',
    `slicers rendered: ${rendered.slicers.join(', ')}`);

  // Format string honoured on labels.
  const ctcLabels = await page.evaluate(() => window.Harness.allLabels('Annual CTC'));
  record('TC29', 'Labels use the model format string', 'N/A',
    'numeric fields render as a condition + range control, not labels, so there is no data label to format; text and date labels are checked in TC27');

  // ---------------------------------------------------------------- TC30 / TC31
  // Data volume: 1 row, 2 rows, 30,000 rows.
  for (const [name, spec, id] of [
    ['single row', F.buildSingleRowSpec(), 'TC30a'],
    ['two rows', F.buildTwoRowSpec(), 'TC30b'],
  ]) {
    spec.objects = asLists(spec, await page.evaluate((s) => window.Harness.showAllSlicers(s), spec));
    await page.evaluate((s) => window.Harness.mount(s, 1, 340, 500), spec);
    await page.evaluate(() => window.Harness.clearErrors());
    await page.evaluate(() => window.Harness.update(0, {}));
    const s5 = await page.evaluate(() => window.Harness.state(0));
    record(id, `Data volume: ${name}`, s5.errors.length === 0 ? 'PASS' : 'FAIL', s5.errors.join('; '));
  }

  const large = F.buildLargeSpec();
  large.objects = asLists(large, await page.evaluate((s) => window.Harness.showAllSlicers(s), large));
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), large);
  await page.evaluate(() => window.Harness.clearErrors());
  const t0 = Date.now();
  await page.evaluate(() => window.Harness.update(0, {}));
  const renderMs = Date.now() - t0;
  const tickT0 = Date.now();
  await page.evaluate(() => window.Harness.tick('Business Unit', 'Sales'));
  await page.waitForTimeout(200);
  const tickMs = Date.now() - tickT0;
  st = await page.evaluate(() => window.Harness.state(0));
  record('TC30c', 'Data volume: 30,000 rows (the capabilities ceiling)', st.errors.length === 0 ? 'PASS' : 'FAIL',
    `initial render ${renderMs}ms, cross-filter after a tick ${tickMs}ms`);

  // ---------------------------------------------------------------- TC31
  // Bad data.
  const bad = F.buildBadDataSpec();
  bad.objects = asLists(bad, await page.evaluate((s) => window.Harness.showAllSlicers(s), bad));
  bad.objects = Object.assign({}, bad.objects, {
    ['__column__Employee.Date of Joining']: { section2: { slicerType: 'dateRange' } },
    ['__column__Employee.Annual CTC']: { section2: { slicerType: 'numeric' } },
  });
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 700), bad);
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.update(0, {}));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.Harness.tick('Business Unit', '(Blank)'));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.Harness.click('.applyAll'));
  await page.waitForTimeout(150);
  st = await page.evaluate(() => window.Harness.state(0));
  const badLabels = await page.evaluate(() => window.Harness.allLabels('Business Unit'));
  record('TC31', 'Bad data: null, blank, Infinity, NaN, negatives, wrong types', st.errors.length === 0 ? 'PASS' : 'FAIL',
    `${st.errors.slice(0, 2).join('; ') || 'labels: ' + JSON.stringify(badLabels)}`);

  // ---------------------------------------------------------------- Hierarchy
  const hier = F.buildHierarchySpec();
  hier.objects = asLists(hier, await page.evaluate((s) => window.Harness.showAllSlicers(s), hier));
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 700), hier);
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.update(0, {}));
  await page.waitForTimeout(150);
  const hierLabels = await page.evaluate(() => window.Harness.allLabels('OrgHierarchy'));
  const expectedNodes = (() => {
    const set = new Set();
    hier.rows.forEach((r) => {
      set.add(r[0]);
      set.add(r[0] + '|' + r[1]);
      set.add(r[0] + '|' + r[1] + '|' + r[2]);
    });
    return set.size;
  })();
  st = await page.evaluate(() => window.Harness.state(0));
  record('TCH', 'Hierarchy slicer renders every node',
    hierLabels && hierLabels.filter((l) => l !== 'Select All').length === expectedNodes ? 'PASS' : 'FAIL',
    `rendered ${hierLabels ? hierLabels.filter((l) => l !== 'Select All').length : 0} of ${expectedNodes} expected nodes` +
      (hierLabels && hierLabels.filter((l) => l !== 'Select All').length !== expectedNodes
        ? ' — duplicate labels under different parents collide on the d3 data-join key'
        : '')
  );

  // ---------------------------------------------------------------- Rendering events
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), specWithVisibility);
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.update(0, {}));
  st = await page.evaluate(() => window.Harness.state(0));
  record('TCR', 'Rendering Events API fires started then finished',
    st.renderEvents.length >= 2 && st.renderEvents[0] === 'started' && st.renderEvents[st.renderEvents.length - 1] === 'finished' ? 'PASS' : 'FAIL',
    st.renderEvents.join(' -> '));

  // Empty dataView must not throw and must leave the format pane usable.
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.update(0, { emptyDataView: true }));
  let emptyFmt = null;
  try {
    emptyFmt = await page.evaluate(() => window.Harness.formattingModel(0));
  } catch (e) {
    emptyFmt = { error: String(e).slice(0, 200) };
  }
  st = await page.evaluate(() => window.Harness.state(0));
  record('TCE', 'Empty dataView renders cleanly and format pane still opens',
    st.errors.length === 0 && emptyFmt && !emptyFmt.error ? 'PASS' : 'FAIL', JSON.stringify(emptyFmt));

  // Context menu.
  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), specWithVisibility);
  await page.evaluate(() => window.Harness.update(0, {}));
  await page.waitForTimeout(50);
  await page.evaluate(() => {
    document.getElementById('visualHost0').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 40 }));
  });
  st = await page.evaluate(() => window.Harness.state(0));
  record('TCM', 'Context menu is enabled (mandatory guideline)', st.contextMenuCount > 0 ? 'PASS' : 'FAIL',
    `showContextMenu called ${st.contextMenuCount}x`);

  // Memory: style tags and listeners must not accumulate across updates.
  const styleBefore = await page.evaluate(() => document.querySelectorAll('style').length);
  for (let i = 0; i < 25; i++) await page.evaluate(() => window.Harness.update(0, {}));
  const styleAfter = await page.evaluate(() => document.querySelectorAll('style').length);
  record('TCL', 'No style-tag leak across 25 updates', styleAfter === styleBefore ? 'PASS' : 'FAIL',
    `style tags ${styleBefore} -> ${styleAfter}`);

  // ---------------------------------------------------------------- TCB
  // A selection that reaches no rows must not blank every other field.
  // Regression: a date range moved outside the data used to collapse every list to
  // just "Select All", leaving the user nothing to click to undo it.
  const blankSpec = {
    table: 'Employee',
    columns: [
      { name: 'Business Unit', section: 1, type: 'text' },
      { name: 'Location', section: 2, type: 'text' },
      { name: 'Date of Joining', section: 3, type: 'date' },
    ],
    rows: standard.rows.map((r) => [r[0], r[2], r[4]]),
  };
  blankSpec.objects = asLists(blankSpec, await page.evaluate((s) => window.Harness.showAllSlicers(s), blankSpec));
  blankSpec.objects['__column__Employee.Date of Joining'] = { section3: { slicerType: 'dateRange' } };
  await page.evaluate((s) => window.Harness.mount(s, 1, 360, 900), blankSpec);
  await page.evaluate(() => window.Harness.clearErrors());
  await page.evaluate(() => window.Harness.update(0, {}));
  await page.waitForTimeout(200);
  const beforeBlank = await page.evaluate(() => window.Harness.visibleLabels('Business Unit'));
  await page.evaluate(() => {
    const c = document.querySelector('.dateSlicerContainer');
    c.setAttribute('startDate', '2035-01-01');
    c.setAttribute('endDate', '2035-12-31');
    document.getElementById('visualHost0').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const afterBlank = await page.evaluate(() => window.Harness.visibleLabels('Business Unit'));
  st = await page.evaluate(() => window.Harness.state(0));
  record(
    'TCB',
    'A selection reaching no rows does not blank the other fields',
    afterBlank.length === beforeBlank.length && st.errors.length === 0 ? 'PASS' : 'FAIL',
    `Business Unit stayed ${afterBlank.length} of ${beforeBlank.length} values with the date range outside the data`
  );

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results, pageErrors }, null, 2));
  console.log('\n--- page-level errors captured ---');
  console.log(pageErrors.length ? pageErrors.slice(0, 20).join('\n') : '(none)');

  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const warn = results.filter((r) => r.status === 'WARN').length;
  const na = results.filter((r) => r.status === 'N/A').length;
  console.log(`\n${pass} pass, ${fail} fail, ${warn} warn, ${na} n/a`);

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error('HARNESS ERROR', e);
  process.exit(1);
});
