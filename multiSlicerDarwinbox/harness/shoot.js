/* eslint-disable */
/**
 * Renders the real packaged visual and captures AppSource listing screenshots:
 * PNG, exactly 1366x768, under 1024 KB, with explanatory callouts.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'appsource', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const BU = ['Sales', 'Engineering', 'Human Resources', 'Finance', 'Customer Success'];
const DEPT = {
  Sales: ['Inside Sales', 'Field Sales', 'Sales Operations'],
  Engineering: ['Platform', 'Data', 'Mobile', 'Quality'],
  'Human Resources': ['Talent Acquisition', 'HR Operations'],
  Finance: ['Payroll', 'Controlling'],
  'Customer Success': ['Onboarding', 'Support'],
};
const LOC = ['Hyderabad', 'Bengaluru', 'Mumbai', 'Pune', 'Gurugram'];
const GRADE = ['G1', 'G2', 'G3', 'G4'];

function sampleSpec() {
  const columns = [
    { name: 'Business Unit', section: 1, type: 'text' },
    { name: 'Department', section: 1, type: 'text' },
    { name: 'Location', section: 2, type: 'text' },
    { name: 'Grade', section: 2, type: 'text' },
    { name: 'Date of Joining', section: 3, type: 'date' },
    { name: 'Annual CTC', section: 3, type: 'number', format: '#,0' },
  ];
  const rows = [];
  let seed = 11;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 400; i++) {
    const bu = BU[Math.floor(rand() * BU.length)];
    rows.push([
      bu,
      DEPT[bu][Math.floor(rand() * DEPT[bu].length)],
      LOC[Math.floor(rand() * LOC.length)],
      GRADE[Math.floor(rand() * GRADE.length)],
      new Date(2021 + Math.floor(rand() * 5), Math.floor(rand() * 12), 1 + Math.floor(rand() * 28)),
      400000 + Math.floor(rand() * 40) * 50000,
    ]);
  }
  return { table: 'Employee', columns, rows };
}

function objectsFor(spec, listCols, extra, onlyCols) {
  const shown = onlyCols ? spec.columns.filter((c) => onlyCols.includes(c.name)) : spec.columns;
  const o = {
    saveState: {
      slicerVisibility: JSON.stringify(
        shown.map((c) => ({ sectionIndex: c.section, label: c.name, query: 'Employee.' + c.name }))
      ),
    },
    design: { sectionFontSize: 11, slicerTitleFontSize: 9, labelFontSize: 9 },
    section1: { sectionName: 'Organisation' },
    section2: { sectionName: 'Location & Grade' },
    section3: { sectionName: 'Joining & Cost' },
  };
  (listCols || []).forEach((name) => {
    const col = spec.columns.find((c) => c.name === name);
    o[`__column__Employee.${name}`] = { [`section${col.section}`]: { slicerType: 'list' } };
  });
  return Object.assign(o, extra || {});
}

const PAGE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; width:1366px; height:768px; overflow:hidden;
    font-family: "Segoe UI", -apple-system, Arial, sans-serif; background:#EEF1F5; }
  .canvas { position:relative; width:1366px; height:768px; }
  .band { position:absolute; inset:0 0 auto 0; height:74px; background:#FFFFFF; border-bottom:1px solid #DCE0E6; }
  .band h1 { margin:0; position:absolute; left:40px; top:18px; font-size:21px; font-weight:600; color:#1B1F26; letter-spacing:-0.2px; }
  .band p  { margin:0; position:absolute; left:40px; top:45px; font-size:13px; color:#616A76; }
  .badge { position:absolute; right:40px; top:26px; font-size:11px; font-weight:600; letter-spacing:.09em;
    text-transform:uppercase; color:#5B6470; background:#EDF0F4; border:1px solid #DCE0E6; padding:5px 11px; border-radius:3px; }
  .panel { position:absolute; left:40px; top:108px; width:344px; height:618px; background:#fff;
    border:1px solid #DCE0E6; border-radius:6px; box-shadow:0 1px 2px rgba(20,25,35,.05), 0 10px 28px -18px rgba(20,25,35,.35); overflow:hidden; }
  .panel > div { width:344px; height:618px; }
  .bubble { position:absolute; background:#FFFFFF; border:1px solid #C9D0D9; border-radius:8px;
    padding:12px 15px; box-shadow:0 2px 4px rgba(20,25,35,.06), 0 12px 30px -20px rgba(20,25,35,.5); max-width:330px; }
  .bubble b { display:block; font-size:13.5px; color:#12386B; margin-bottom:4px; font-weight:650; }
  .bubble span { display:block; font-size:12.5px; line-height:1.5; color:#414B58; }
  .num { position:absolute; width:23px; height:23px; border-radius:50%; background:#12386B; color:#fff;
    font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(18,56,107,.35); }
  svg.leads { position:absolute; inset:0; width:1366px; height:768px; pointer-events:none; }
  .foot { position:absolute; left:40px; bottom:14px; font-size:11px; color:#78818E; }
`;

async function shoot(page, spec, opts) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <link rel="stylesheet" href="visual.css"><style>${PAGE_CSS}</style></head>
    <body><div class="canvas">
      <div class="band"><h1>${opts.title}</h1><p>${opts.subtitle}</p><div class="badge">Darwinbox Multislicer</div></div>
      <div class="panel"><div id="visualHost0"></div></div>
      <svg class="leads">${opts.leads || ''}</svg>
      ${opts.bubbles}
      <div class="foot">Sample data shown for illustration.</div>
    </div>
    <script src="pbi-host.js"></script><script src="visual.js"></script>
    <script>
      window.__errors=[];
      window.Harness={instances:[],
        mount(spec,w,h){
          const ISO=/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/;
          spec.columns.forEach((c,ci)=>{ if(c.type==='date'||c.type==='time'){ spec.rows.forEach(r=>{ if(typeof r[ci]==='string'&&ISO.test(r[ci])) r[ci]=new Date(r[ci]); }); }});
          const el=document.getElementById('visualHost0'); el.style.width=w+'px'; el.style.height=h+'px';
          const sim=new window.PbiHostSimulator(spec);
          const v=window.powerbi.visuals.plugins['multiSlicerDarwinbox821D578930EF4108BB76486B5F41070E'].create({element:el,host:sim.createHost()});
          this.instances=[{sim,visual:v,el,w,h}]; return true;
        },
        update(){const i=this.instances[0];
          i.visual.update({type:62,viewport:{width:i.w,height:i.h},dataViews:[i.sim.buildDataView()],
            jsonFilters:i.sim.jsonFilter?[i.sim.jsonFilter]:[],viewMode:1,editMode:0,operationKind:0}); return true;},
        tick(name,label){
          const c=Array.prototype.find.call(document.querySelectorAll('.slicerContainer'),e=>e.getAttribute('slicerLabel')===name);
          if(!c) return 'no-slicer';
          const row=Array.prototype.find.call(c.querySelectorAll('.checkboxDiv'),e=>e.getAttribute('label')===label);
          if(!row) return 'no-row';
          const inp=row.querySelector('input.checkbox'); inp.checked=!inp.checked;
          inp.dispatchEvent(new Event('change',{bubbles:true})); return inp.checked;},
        openDropdown(name){
          const c=Array.prototype.find.call(document.querySelectorAll('.slicerContainer'),e=>e.getAttribute('slicerLabel')===name);
          if(!c) return false; const d=c.querySelector('.dropdown-input'); if(!d) return false;
          d.dispatchEvent(new MouseEvent('click',{bubbles:true})); return true;},
      };
    </script></body></html>`;

  const file = path.join(__dirname, `__shot_${opts.file}.html`);
  fs.writeFileSync(file, html);
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.Harness && window.powerbi);
  await page.evaluate((s) => window.Harness.mount(s, 344, 618), spec);
  await page.evaluate(() => window.Harness.update());
  await page.waitForTimeout(250);
  if (opts.act) await opts.act(page);
  await page.waitForTimeout(350);
  const out = path.join(OUT, opts.file + '.png');
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1366, height: 768 } });
  fs.unlinkSync(file);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`  ${opts.file}.png  ${kb} KB  ${kb <= 1024 ? 'OK' : 'TOO LARGE'}`);
}

function lead(x1, y1, x2, y2) {
  return `<path d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}"
    fill="none" stroke="#12386B" stroke-width="1.6" stroke-dasharray="4 3" opacity="0.65"/>
    <circle cx="${x2}" cy="${y2}" r="3.5" fill="#12386B"/>`;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
  const spec = sampleSpec();

  console.log('Capturing AppSource screenshots (1366x768 PNG):');

  // 1 — Overview
  await shoot(page, Object.assign({}, spec, { objects: objectsFor(spec, []) }), {
    file: '01-overview',
    title: 'Many filters, one visual',
    subtitle: 'Replace a page full of slicers with a single scrollable panel, grouped into named sections.',
    leads: [lead(700, 190, 392, 190), lead(700, 330, 392, 262), lead(700, 470, 392, 132), lead(700, 640, 392, 698)].join(''),
    bubbles: `
      <div class="num" style="left:706px; top:178px;">1</div>
      <div class="bubble" style="left:742px; top:166px;"><b>Group filters into sections</b>
        <span>Up to five named sections, each collapsible, so twenty filters stay readable in a narrow panel.</span></div>
      <div class="num" style="left:706px; top:318px;">2</div>
      <div class="bubble" style="left:742px; top:306px;"><b>Pick the control per field</b>
        <span>List, dropdown, date range, numeric condition or time — set per field in the format pane, no code.</span></div>
      <div class="num" style="left:706px; top:458px;">3</div>
      <div class="bubble" style="left:742px; top:446px;"><b>Search across every filter</b>
        <span>The box at the top finds a filter by name; each list has its own search for finding a value inside it.</span></div>
      <div class="num" style="left:706px; top:628px;">4</div>
      <div class="bubble" style="left:742px; top:616px;"><b>Apply once, not per click</b>
        <span>Build the whole selection, then Apply — the report refreshes a single time instead of after every tick.</span></div>`,
  });

  // 2 — Cross-filtering
  await shoot(page, Object.assign({}, spec, {
    objects: objectsFor(spec, ['Business Unit', 'Department', 'Location'], null, ['Business Unit', 'Department', 'Location']),
  }), {
    file: '02-cross-filter',
    title: 'Filters that narrow each other',
    subtitle: 'Choose a business unit and every other field immediately drops the values that have no matching data.',
    act: async (p) => {
      await p.evaluate(() => window.Harness.tick('Business Unit', 'Engineering'));
      await p.waitForTimeout(250);
    },
    leads: [lead(700, 200, 392, 325), lead(700, 360, 392, 450)].join(''),
    bubbles: `
      <div class="num" style="left:706px; top:188px;">1</div>
      <div class="bubble" style="left:742px; top:176px;"><b>Engineering is selected</b>
        <span>The field you are clicking in always keeps its full list, so you can change your mind without reopening anything.</span></div>
      <div class="num" style="left:706px; top:348px;">2</div>
      <div class="bubble" style="left:742px; top:336px;"><b>Everything else narrows</b>
        <span>Department and Location now show only values that exist for Engineering. No more picking a combination that returns an empty report.</span></div>
      <div class="bubble" style="left:742px; top:470px; max-width:360px;"><b>Switch it off per report</b>
        <span>A single toggle in the format pane — <i>Filtering &rarr; Filter other fields</i> — returns every list to showing all of its values.</span></div>`,
  });

  // 3 — Field types
  const typeSpec = Object.assign({}, spec, {
    objects: objectsFor(
      spec,
      [],
      {
        '__column__Employee.Date of Joining': { section3: { slicerType: 'dateRange' } },
        '__column__Employee.Annual CTC': { section3: { slicerType: 'numeric', decimal: 0 } },
      },
      ['Business Unit', 'Date of Joining', 'Annual CTC']
    ),
  });
  await shoot(page, typeSpec, {
    file: '03-field-types',
    title: 'Text, dates and numbers in one panel',
    subtitle: 'Each field gets the control that suits it, without leaving the visual.',
    act: async (p) => {
      await p.evaluate(() => window.Harness.openDropdown('Business Unit'));
      await p.waitForTimeout(150);
      await p.evaluate(() => window.Harness.tick('Business Unit', 'Engineering'));
      await p.evaluate(() => window.Harness.tick('Business Unit', 'Finance'));
      await p.waitForTimeout(150);
      await p.evaluate(() => window.Harness.openDropdown('Business Unit'));
      await p.waitForTimeout(200);
    },
    leads: [lead(700, 210, 392, 250), lead(700, 400, 392, 400), lead(700, 560, 392, 530)].join(''),
    bubbles: `
      <div class="num" style="left:706px; top:198px;">1</div>
      <div class="bubble" style="left:742px; top:186px;"><b>Dropdowns with chips</b>
        <span>Collapsed by default to save space; selected values show as removable chips so the current state is readable at a glance.</span></div>
      <div class="num" style="left:706px; top:388px;">2</div>
      <div class="bubble" style="left:742px; top:376px;"><b>Date range or relative date</b>
        <span>Drag the slider, type exact dates, or switch to relative filtering — In Last / In Next / Is Before / Is Between.</span></div>
      <div class="num" style="left:706px; top:548px;">3</div>
      <div class="bubble" style="left:742px; top:536px;"><b>Numeric and time conditions</b>
        <span>Is less than, Is greater than, Is between — with the decimal precision you choose. A field you have not touched never filters the report.</span></div>`,
  });

  // 4 — Choose which filters appear
  await shoot(page, Object.assign({}, spec, { objects: objectsFor(spec, ['Business Unit', 'Department', 'Location', 'Grade']) }), {
    file: '04-manage-filters',
    title: 'Readers choose the filters they need',
    subtitle: 'Add or remove filters from the panel in reading view — no edit rights, no report changes.',
    act: async (p) => {
      await p.evaluate(() => {
        const btn = document.querySelector('.addFilter');
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await p.waitForTimeout(250);
    },
    leads: [lead(700, 200, 392, 300), lead(700, 400, 392, 490)].join(''),
    bubbles: `
      <div class="num" style="left:706px; top:188px;">1</div>
      <div class="bubble" style="left:742px; top:176px;"><b>Add Filter</b>
        <span>Every field the author put in the visual is listed here. Tick the ones you want on screen and save — the choice is remembered with the report.</span></div>
      <div class="num" style="left:706px; top:388px;">2</div>
      <div class="bubble" style="left:742px; top:376px;"><b>Save keeps the choice</b>
        <span>The panel remembers which filters are on screen, so the next person to open the report sees the same short list.</span></div>
      <div class="bubble" style="left:742px; top:500px; max-width:360px;"><b>Or drop one straight from the panel</b>
        <span>The bin icon beside any filter removes it, and Reset clears every selection across all sections in one click.</span></div>`,
  });

  await browser.close();
  console.log('\nSaved to appsource/screenshots/');
})();
