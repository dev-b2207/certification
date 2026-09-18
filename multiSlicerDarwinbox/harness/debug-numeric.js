/* eslint-disable */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForFunction(() => window.Harness && window.powerbi);

  // Three business units, CTC 100/200/300. Nobody touches the numeric slicer.
  const spec = {
    table: 'Employee',
    columns: [
      { name: 'Business Unit', section: 1, type: 'text' },
      { name: 'Annual CTC', section: 1, type: 'number' },
    ],
    rows: [
      ['Sales', 100],
      ['Sales', 200],
      ['Sales', 300],
      ['Engineering', 100],
      ['Engineering', 300],
    ],
  };
  spec.objects = await page.evaluate((s) => window.Harness.showAllSlicers(s), spec);
  // Force the text field to a visible list so we can tick it directly.
  spec.objects['__column__Employee.Business Unit'] = { section1: { slicerType: 'list' } };

  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), spec);
  await page.evaluate(() => window.Harness.update(0, {}));
  await page.waitForTimeout(100);

  const numericAttrs = await page.evaluate(() => {
    const c = document.querySelector('.numberSlicerContainer');
    return c
      ? { condition: c.getAttribute('condition'), minValue: c.getAttribute('minValue'), maxValue: c.getAttribute('maxValue') }
      : null;
  });
  console.log('Numeric slicer rendered with defaults, untouched:', JSON.stringify(numericAttrs));

  await page.evaluate(() => window.Harness.tick('Business Unit', 'Sales'));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.Harness.click('.applyAll'));
  await page.waitForTimeout(100);

  const st = await page.evaluate(() => window.Harness.state(0));
  console.log('\nUser ticked Business Unit = Sales and nothing else.');
  console.log('Filter target :', JSON.stringify(st.jsonFilter.target));
  console.log('Filter values :', JSON.stringify(st.jsonFilter.values));
  console.log('Rows a downstream visual now sees:', st.downstreamRows, 'of', st.totalRows);
  console.log('Rows it SHOULD see (all Sales):', 3);
  console.log(st.downstreamRows === 3 ? '\nOK' : '\nBUG: the untouched numeric slicer dropped the max-value row.');

  await browser.close();
})();
