/* eslint-disable */
/** Does each slicer type abstain from the filter when the user never touches it? */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForFunction(() => window.Harness && window.powerbi);

  const cases = [
    { label: 'date  (dateRange)', type: 'date', slicerType: 'dateRange' },
    { label: 'number(numeric)  ', type: 'number', slicerType: 'numeric' },
    { label: 'time  (time)     ', type: 'time', slicerType: 'time' },
    { label: 'text  (list)     ', type: 'text', slicerType: 'list' },
  ];

  console.log('User ticks ONLY "Business Unit = Sales". Which other fields join the filter?\n');

  for (const c of cases) {
    const extraValues = [];
    for (let i = 0; i < 6; i++) {
      if (c.type === 'date') extraValues.push(new Date(2023, i, 1 + i));
      else if (c.type === 'number') extraValues.push(100 + i * 50);
      else if (c.type === 'time') extraValues.push(new Date(Date.UTC(1970, 0, 1, 8 + i, 0, 0)));
      else extraValues.push('X' + (i % 3));
    }
    const spec = {
      table: 'Employee',
      columns: [
        { name: 'Business Unit', section: 1, type: 'text' },
        { name: 'Extra', section: 2, type: c.type },
      ],
      rows: ['Sales', 'Sales', 'Sales', 'Engineering', 'Engineering', 'Engineering'].map((bu, i) => [bu, extraValues[i]]),
    };
    spec.objects = await page.evaluate((s) => window.Harness.showAllSlicers(s), spec);
    spec.objects['__column__Employee.Business Unit'] = { section1: { slicerType: 'list' } };
    spec.objects['__column__Employee.Extra'] = { section2: { slicerType: c.slicerType } };

    await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), spec);
    await page.evaluate(() => window.Harness.update(0, {}));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.Harness.tick('Business Unit', 'Sales'));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.Harness.click('.applyAll'));
    await page.waitForTimeout(150);

    const st = await page.evaluate(() => window.Harness.state(0));
    const targets = st.jsonFilter ? (Array.isArray(st.jsonFilter.target) ? st.jsonFilter.target : [st.jsonFilter.target]) : [];
    const cols = targets.map((t) => t.column);
    const joined = cols.includes('Extra');
    const rows = st.downstreamRows;
    console.log(
      `${c.label}  targets=[${cols.join(', ')}]  downstream rows=${rows}/3 expected  ${
        joined || rows !== 3 ? '<-- PROBLEM: untouched field constrains the filter' : 'OK'
      }`
    );
  }

  await browser.close();
})();
