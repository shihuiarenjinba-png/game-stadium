"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

function createUiHarness(){
  let markup="",handlers={},saved=new Map();
  const root={set innerHTML(value){markup=value;},get innerHTML(){return markup;}};
  const fields={focus:"stamina",intensity:"normal",strategy:"steady"};
  const document={
    getElementById(id){if(id==="app")return root;return {value:fields[id]??(id.startsWith("leg-")?String(Number(id.slice(-1))+1):""),files:[],click(){}};},
    addEventListener(type,fn){handlers[type]=fn;}
  };
  const localStorage={getItem:k=>saved.get(k)||null,setItem:(k,value)=>saved.set(k,value)};
  const context={document,localStorage,console,Date,setTimeout:fn=>fn(),confirm:()=>true};
  const global=vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../src/engine.js"),"utf8"),global,{filename:"engine.js"});
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../src/app.js"),"utf8"),global,{filename:"app.js"});
  return {
    get markup(){return markup;},
    get state(){return JSON.parse(saved.get("ekiden-manager-v1"));},
    click(action,key){assert.ok(handlers.click,"click handler registered");handlers.click({target:{closest:()=>({disabled:false,dataset:{action,key}})}});},
    setField(id,value){fields[id]=value;},
    engine:global.EkidenEngine
  };
}

test("training, scouting, checkpoint map, year-end accounting, and autosave run end-to-end",()=>{
  const app=createUiHarness();
  assert.match(app.markup,/EKIDEN/);
  assert.match(app.markup,/年度決算/);
  assert.match(app.markup,/監督手帳/);
  assert.match(app.markup,/ライバル大学の偵察/);
  app.click("scout");
  assert.equal(app.state.scouting,1);
  assert.equal(app.state.cash,2220000);
  for(let w=0;w<12;w++)app.click("train");
  assert.equal(app.state.week,12);
  app.click("start");
  assert.match(app.markup,/スタート前/);
  assert.match(app.markup,/class="course"/);
  for(let checkpoint=0;checkpoint<15;checkpoint++){
    app.setField("strategy",checkpoint%3===2?"push":"steady");
    app.click("next");
    assert.equal(app.state.race.notes.length,checkpoint+1);
  }
  assert.equal(app.state.race.finished,true);
  assert.match(app.markup,/年度決算を確定して次年度へ/);
  const ending=app.state.cash;
  app.click("close");
  assert.equal(app.state.year,2);
  assert.match(app.markup,/歴代成績・年度決算/);
  assert.match(app.markup,/決算明細/);
  assert.match(app.markup,/卒業生の記録/);
  assert.match(app.markup,/最終順位/);
  assert.equal(app.state.history[0].finance.ending,ending);
  assert.equal(app.engine.financials(app.state).ending,app.state.cash);
});
test("a new install is offline and uses only local JavaScript/CSS assets",()=>{
  const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
  assert.match(html,/Content-Security-Policy/);
  assert.match(html,/connect-src 'none'/);
  assert.doesNotMatch(html,/https?:\/\//);
  assert.match(html,/src\/engine\.js/);
  assert.match(html,/src\/app\.js/);
});
test("renderer code is independent of Node integration, and navigation is blocked in desktop host",()=>{
  const script=fs.readFileSync(path.join(__dirname,"../desktop/main.cjs"),"utf8");
  assert.match(script,/nodeIntegration:false/);
  assert.match(script,/contextIsolation:true/);
  assert.match(script,/sandbox:true/);
  assert.match(script,/setWindowOpenHandler/);
  assert.match(script,/onBeforeRequest/);
});
