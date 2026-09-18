/* eslint-disable */
/** Regression guard for the abstain-until-touched fix: touched slicers must still filter. */
const path = require('path');
const { chromium } = require('playwright');

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'ok   ' : 'FAIL '} ${label}  got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  page.on('pageerror', (e) => {
    console.log('PAGEERROR', String(e));
    failures++;
  });
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForFunction(() => window.Harness && window.powerbi);

  // ---------------------------------------------------------------- numeric
  const numSpec = {
    table: 'Employee',
    columns: [
      { name: 'Business Unit', section: 1, type: 'text' },
      { name: 'Annual CTC', section: 1, type: 'number' },
    ],
    rows: [
      ['Sales', 100],
      ['Sales', 200],
      ['Sales', 300],
      ['Engineering', 400],
      ['Engineering', 500],
    ],
  };
  numSpec.objects = await page.evaluate((s) => window.Harness.showAllSlicers(s), numSpec);
  numSpec.objects['__column__Employee.Business Unit'] = { section1: { slicerType: 'list' } };

  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), numSpec);
  await page.evaluate(() => window.Harness.update(0, {}));
  await page.waitForTimeout(120);

  // User types 250 into the "To" box of the default "Is less than" condition.
  await page.evaluate(() => {
    const el = document.querySelector('.numberSlicerContainer .toInput');
    el.value = '250';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(150);
  const touchedAttr = await page.evaluate(() => document.querySelector('.numberSlicerContainer').getAttribute('userModified'));
  check('numeric marked as touched after editing To', touchedAttr, 'true');

  await page.evaluate(() => window.Harness.click('.applyAll'));
  await page.waitForTimeout(150);
  let st = await page.evaluate(() => window.Harness.state(0));
  check('numeric "Is less than 250" keeps rows 100 and 200', st.downstreamRows, 2);

  // Combined with a text selection.
  await page.evaluate(() => window.Harness.tick('Business Unit', 'Sales'));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.Harness.click('.applyAll'));
  await page.waitForTimeout(150);
  st = await page.evaluate(() => window.Harness.state(0));
  check('numeric + text combine', st.downstreamRows, 2);

  // Survives a re-render: the selection must not be dropped when Power BI updates.
  await page.evaluate(() => window.Harness.update(0, {}));
  await page.waitForTimeout(150);
  const survived = await page.evaluate(() => document.querySelector('.numberSlicerContainer').getAttribute('userModified'));
  check('numeric stays touched across a re-render', survived, 'true');

  // ---------------------------------------------------------------- time
  const timeSpec = {
    table: 'Employee',
    columns: [
      { name: 'Business Unit', section: 1, type: 'text' },
      { name: 'Shift Start', section: 1, type: 'time' },
    ],
    rows: [
      ['Sales', new Date(Date.UTC(1970, 0, 1, 8, 0, 0))],
      ['Sales', new Date(Date.UTC(1970, 0, 1, 10, 0, 0))],
      ['Sales', new Date(Date.UTC(1970, 0, 1, 14, 0, 0))],
      ['Engineering', new Date(Date.UTC(1970, 0, 1, 18, 0, 0))],
    ],
  };
  timeSpec.objects = await page.evaluate((s) => window.Harness.showAllSlicers(s), timeSpec);
  timeSpec.objects['__column__Employee.Business Unit'] = { section1: { slicerType: 'list' } };
  timeSpec.objects['__column__Employee.Shift Start'] = { section1: { slicerType: 'time' } };

  await page.evaluate((s) => window.Harness.mount(s, 1, 340, 640), timeSpec);
  await page.evaluate(() => window.Harness.update(0, {}));
  await page.waitForTimeout(150);

  const beforeTouch = await page.evaluate(() => document.querySelector('.timeSlicerContainer').getAttribute('dateSelectionMade'));
  check('time starts untouched', beforeTouch, 'false');

  // User picks the "Is greater than" condition, then sets 09:00.
  await page.evaluate(() => {
    const items = document.querySelectorAll('.timeDropdownItem');
    const target = Array.prototype.find.call(items, (el) => el.textContent === 'Is greater than');
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const el = document.querySelector('.fromTimeInput');
    el.value = '09:00:00';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(150);
  const afterTouch = await page.evaluate(() => document.querySelector('.timeSlicerContainer').getAttribute('dateSelectionMade'));
  check('time marked as touched after picking a condition', afterTouch, 'true');

  await page.evaluate(() => window.Harness.click('.applyAll'));
  await page.waitForTimeout(150);
  st = await page.evaluate(() => window.Harness.state(0));
  check('time "Is greater than 09:00" keeps the 10:00, 14:00 and 18:00 rows', st.downstreamRows, 3);

  console.log(`\n${failures === 0 ? 'ALL REGRESSION CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})();
