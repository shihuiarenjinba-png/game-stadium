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
  await click("scout");
  for(let i=0;i<12;i++)await click("train");
  const week=await query("JSON.parse(localStorage.getItem('ekiden-manager-v1')).week");
  assert.equal(week,12);
  await click("start");
  assert.equal(await query("document.querySelectorAll('.course circle').length")>=8,true);
  for(let i=0;i<6;i++)await click("next");
  const stage=await query("JSON.parse(localStorage.getItem('ekiden-manager-v1')).race");
  assert.equal(stage.leg,2);
  assert.equal(stage.segment,0);
  await screenshot("02-race");
  for(let i=6;i<15;i++)await click("next");
  assert.match(await query("document.body.innerText"),/大会終了/);
  await screenshot("03-finish");
  await click("close");
  assert.match(await query("document.body.innerText"),/2年目/);
  assert.match(await query("document.body.innerText"),/歴代成績・年度決算/);
  await screenshot("04-year-two");
  console.log("WINDOWS UI SMOKE PASS: training, scouting, 15 checkpoints, end-of-year rollover, screenshots");
}
app.whenReady().then(run).then(()=>{if(win)win.close();app.quit();}).catch(error=>{console.error("WINDOWS UI SMOKE FAIL",error);app.exit(1);});
