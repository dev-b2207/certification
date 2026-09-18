const path=require('path'); const {chromium}=require('playwright');
const H='/home/claude/work/harness';

function spec(relative){
  const BU=['Sales','Engineering','Finance'], LOC=['Hyderabad','Bengaluru','Mumbai'];
  const rows=[];
  for(let i=0;i<60;i++) rows.push([BU[i%3], LOC[(i*2)%3], new Date(2023,(i*5)%12,1+(i*3)%27)]);
  const dateObj = relative
    ? {section3:{slicerType:'dateRange', relativeDate:true, dateType:'In Last', duration:1, durationType:'Days'}}
    : {section3:{slicerType:'dateRange'}};
  return {table:'Employee',
    columns:[{name:'Business Unit',section:1,type:'text'},
             {name:'Location',section:2,type:'text'},
             {name:'Date of Joining',section:3,type:'date'}],
    rows,
    objects:{saveState:{slicerVisibility:JSON.stringify([
        {sectionIndex:1,label:'Business Unit',query:'Employee.Business Unit'},
        {sectionIndex:2,label:'Location',query:'Employee.Location'},
        {sectionIndex:3,label:'Date of Joining',query:'Employee.Date of Joining'}])},
      '__column__Employee.Business Unit':{section1:{slicerType:'list'}},
      '__column__Employee.Location':{section2:{slicerType:'list'}},
      '__column__Employee.Date of Joining':dateObj}};
}

async function run(label, relative, tweak){
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await b.newPage({viewport:{width:900,height:960}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+path.join(H,'index.html'));
  await p.waitForFunction(()=>window.Harness&&window.powerbi);
  await p.evaluate(s=>window.Harness.mount(s,1,360,900), spec(relative));
  await p.evaluate(()=>window.Harness.update(0,{}));
  await p.waitForTimeout(250);
  if(tweak) await tweak(p);
  await p.evaluate(()=>{
    document.querySelector('#visualHost0').dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
  });
  await p.waitForTimeout(300);
  const r=await p.evaluate(()=>({
    bu:window.Harness.visibleLabels('Business Unit'),
    loc:window.Harness.visibleLabels('Location')}));
  const gone = r.bu.filter(x=>x!=='Select All').length===0 && r.loc.filter(x=>x!=='Select All').length===0;
  console.log(`${label}`);
  console.log(`   BU =${JSON.stringify(r.bu)}`);
  console.log(`   LOC=${JSON.stringify(r.loc)}`);
  console.log(`   ${gone?'*** REPRODUCED — only Select All remains ***':'ok'}`);
  if(errs.length) console.log('   errors:',errs);
  await b.close();
}

(async()=>{
  await run('A. Relative date "In Last 1 Days" (no rows in that window)', true, null);
  await run('B. Absolute date range moved outside the data', false, async p=>{
    await p.evaluate(()=>{
      const c=document.querySelector('.dateSlicerContainer');
      c.setAttribute('startDate','2035-01-01'); c.setAttribute('endDate','2035-12-31');
    });
  });
})();
