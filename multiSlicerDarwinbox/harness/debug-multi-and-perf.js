/* eslint-disable */
const path = require('path');
const { chromium } = require('playwright');
const F = require('./fixtures');

function asLists(spec, base) {
  const objects = Object.assign({}, base);
  spec.columns.forEach((c) => {
    if (c.type === 'text' && !c.hierarchyGroup) {
      objects[`__column__Employee.${c.name}`] = { [`section${c.section}`]: { slicerType: 'list' } };
    }
  });
  return objects;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));

  // ---------------------------------------------------------------------
  // 1. Multiple instances, each in its own sandboxed iframe (what Power BI does)
  // ---------------------------------------------------------------------
  const spec = F.buildStandardSpec(120);
  const base = { saveState: { slicerVisibility: JSON.stringify(spec.columns.map((c) => ({ sectionIndex: c.section, label: c.name, query: 'Employee.' + c.name }))) } };
  spec.objects = asLists(spec, base);

  await page.goto('file://' + path.join(__dirname, 'two-instances.html'));
  await page.waitForTimeout(800);

  const frames = page.frames().filter((f) => f.url().includes('iframe-host.html'));
  console.log('iframes booted:', frames.length);
  for (const f of frames) {
    await f.evaluate((s) => window.Sandbox.boot(s, 340, 620), spec);
    await f.evaluate(() => window.Sandbox.update());
  }
  await page.waitForTimeout(200);

  const before = [];
  for (const f of frames) before.push(await f.evaluate(() => window.Sandbox.visibleLabels('Department')));
  await frames[0].evaluate(() => window.Sandbox.tick('Business Unit', 'Sales'));
  await page.waitForTimeout(250);
  const after = [];
  for (const f of frames) after.push(await f.evaluate(() => window.Sandbox.visibleLabels('Department')));

  console.log('\n--- Two instances, each in its own sandboxed iframe (production layout) ---');
  console.log('instance 0 Department:', before[0].length, '->', after[0].length);
  console.log('instance 1 Department:', before[1].length, '->', after[1].length);
  const isolated = after[0].length < before[0].length && after[1].length === before[1].length;
  console.log(isolated ? 'ISOLATED: instance 1 unaffected by instance 0' : 'LEAK: instances share state even across iframes');

  // ---------------------------------------------------------------------
  // 2. Where does the 30,000-row render time go?
  // ---------------------------------------------------------------------
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForFunction(() => window.Harness && window.powerbi);

  console.log('\n--- Render cost by row count (6 fields) ---');
  for (const rowCount of [1000, 5000, 15000, 30000]) {
    const s = F.buildStandardSpec(rowCount);
    s.objects = asLists(s, {
      saveState: { slicerVisibility: JSON.stringify(s.columns.map((c) => ({ sectionIndex: c.section, label: c.name, query: 'Employee.' + c.name }))) },
    });
    await page.evaluate((x) => window.Harness.mount(x, 1, 340, 640), s);
    const ms = await page.evaluate(() => {
      const t = performance.now();
      window.Harness.update(0, {});
      return Math.round(performance.now() - t);
    });
    const distinct = new Set(s.rows.map((r) => String(r[4]))).size;
    console.log(`  ${String(rowCount).padStart(6)} rows  ${String(ms).padStart(6)}ms   (distinct dates: ${distinct})`);
  }

  // Same rows, but drop the high-cardinality date column.
  console.log('\n--- Same 30,000 rows without the high-cardinality date field ---');
  const noDate = F.buildStandardSpec(30000);
  noDate.columns = noDate.columns.filter((c) => c.type !== 'date');
  noDate.rows = noDate.rows.map((r) => [r[0], r[1], r[2], r[3], r[5]]);
  noDate.objects = asLists(noDate, {
    saveState: { slicerVisibility: JSON.stringify(noDate.columns.map((c) => ({ sectionIndex: c.section, label: c.name, query: 'Employee.' + c.name }))) },
  });
  await page.evaluate((x) => window.Harness.mount(x, 1, 340, 640), noDate);
  const msNoDate = await page.evaluate(() => {
    const t = performance.now();
    window.Harness.update(0, {});
    return Math.round(performance.now() - t);
  });
  console.log(`  30000 rows, 5 low-cardinality fields: ${msNoDate}ms`);

  await browser.close();
})();
