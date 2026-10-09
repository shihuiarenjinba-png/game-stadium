"use strict";
/* Real Windows Electron smoke, not a mocked DOM test. This runs only in CI.
 * Writes screenshots into smoke-output and exits nonzero on failed controls.
 */
const {app,BrowserWindow}=require("electron");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const assert=require("node:assert/strict");

const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),"ekiden-ui-smoke-"));
app.setPath("userData",dataDir);
app.commandLine.appendSwitch("disable-gpu");
const out=path.join(process.cwd(),"smoke-output");
fs.mkdirSync(out,{recursive:true});
let win;
async function query(script){
  return win.webContents.executeJavaScript(script,true);
}
async function click(action){
  const didClick=await query(`(()=>{const b=document.querySelector('[data-action="${action}"]');if(!b||b.disabled)return false;b.click();return true})()`);
  assert.equal(didClick,true,"button enabled and clickable: "+action);
}
async function screenshot(name){
  await query("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  const picture=await win.webContents.capturePage();
  const buffer=picture.toPNG();
  assert.ok(buffer.byteLength>3000,"screenshot should have image data: "+name);
  fs.writeFileSync(path.join(out,name+".png"),buffer);
}
async function run(){
  win=new BrowserWindow({
    show:true,width:1300,height:850,backgroundColor:"#10171d",
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}
  });
  await win.loadFile(path.join(__dirname,"..","index.html"));
  assert.match(await query("document.body.innerText"),/EKIDEN MANAGER/);
  await screenshot("01-start");
  const originalRng=await query("JSON.parse(localStorage.getItem('ekiden-manager-v1')).rng");
  assert.equal(await query("document.documentElement.lang"),"ja");
  await query("document.querySelector('[data-action=locale][data-lang=en]').click()");
  assert.equal(await query("document.documentElement.lang"),"en");
  assert.match(await query("document.body.innerText"),/High School Scouting Network/);
  assert.match(await query("document.body.innerText"),/Big-stage Poise/);
  assert.equal(await query("JSON.parse(localStorage.getItem('ekiden-manager-v1')).rng"),originalRng);
  await screenshot("01-english-ekiden-not-soccer");
  await query("document.querySelector('[data-action=locale][data-lang=ja]').click()");
  assert.equal(await query("document.documentElement.lang"),"ja");
  assert.match(await query("document.body.innerText"),/全国高校スカウト/);
  assert.equal(await query("document.querySelectorAll('#scout-school option').length"),40);
  await query("(()=>{const x=document.getElementById('scout-school');x.value='3';return x.value})()");
  await click("scout");
  assert.equal(await query("JSON.parse(localStorage.getItem('ekiden-manager-v1')).scoutedSchools.includes(3)"),true);
  assert.ok(await query("document.querySelectorAll('[data-action=target]').length")>=2);
  await screenshot("01-scout-high-school");
  await query("(()=>{const p=[...document.querySelectorAll('.panel')].find(p=>p.querySelector('h2')?.textContent.includes('選手名鑑'));if(p)p.scrollIntoView({block:'start'});return !!p})()");
  assert.match(await query("document.body.innerText"),/失速リスク/);
  await screenshot("01-roster-mental");
  await query("window.scrollTo(0,0)");
  for(let i=0;i<12;i++)await click("train");
  const week=await query("JSON.parse(localStorage.getItem('ekiden-manager-v1')).week");
  assert.equal(week,12);
  assert.match(await query("document.body.innerText"),/順位予想/);
  await screenshot("02-odds");
  await click("prediction");
  const predictionStatus=await query("JSON.parse(localStorage.getItem('ekiden-manager-v1')).prediction.status");
  assert.equal(predictionStatus,"placed");
  await click("start");
  assert.match(await query("document.body.innerText"),/給水ステーション/);
  assert.equal(await query("document.querySelectorAll('.course circle').length")>=8,true);
  for(let i=0;i<6;i++)await click("next");
  assert.equal(await query("JSON.parse(localStorage.getItem(\'ekiden-manager-v1\')).race.waterSpent"),6*12000);
  const stage=await query("JSON.parse(localStorage.getItem('ekiden-manager-v1')).race");
  assert.equal(stage.leg,2);
  assert.equal(stage.segment,0);
  await query("document.querySelector('.mental-live')?.scrollIntoView({block:'start'})");
  await screenshot("02-race-mental");
  await query("window.scrollTo(0,0)");
  await screenshot("02-race");
  for(let i=6;i<15;i++)await click("next");
  assert.equal(await query("JSON.parse(localStorage.getItem(\'ekiden-manager-v1\')).race.waterCups"),15);
  assert.match(await query("document.body.innerText"),/大会終了/);
  const payoutStatus=await query("JSON.parse(localStorage.getItem('ekiden-manager-v1')).prediction.status");
  assert.ok(["won","lost"].includes(payoutStatus));
  await screenshot("03-finish");
  await click("close");
  assert.equal(await query("JSON.parse(localStorage.getItem(\'ekiden-manager-v1\')).year"),2);
  assert.match(await query("document.body.innerText"),/歴代成績・年度決算/);
  await screenshot("04-year-two");
  // Responsive and zoom smoke: this is not a substitute for a human DPI review.
  win.setSize(900,700);
  await screenshot("05-compact");
  let dimensions=await query("({viewport:window.innerWidth,content:document.documentElement.scrollWidth})");
  assert.ok(dimensions.content<=dimensions.viewport+8,"no horizontal page overflow at compact width: "+JSON.stringify(dimensions));
  win.webContents.setZoomFactor(1.25);
  await screenshot("06-zoom125");
  dimensions=await query("({viewport:window.innerWidth,content:document.documentElement.scrollWidth})");
  assert.ok(dimensions.content<=dimensions.viewport+8,"no horizontal overflow at 125% zoom: "+JSON.stringify(dimensions));
  win.webContents.setZoomFactor(1);
  win.setSize(1500,900);
  await screenshot("07-wide");
  console.log("WINDOWS UI SMOKE PASS: training, scouting, 15 checkpoints, end-of-year rollover, screenshots");
}
app.whenReady().then(run).then(()=>{if(win)win.close();app.quit();}).catch(error=>{console.error("WINDOWS UI SMOKE FAIL",error);app.exit(1);});
