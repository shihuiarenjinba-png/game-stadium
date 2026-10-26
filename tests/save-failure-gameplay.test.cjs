"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const script=fs.readFileSync("src/app.js","utf8"),engine=fs.readFileSync("src/engine.js","utf8");
function boot({saved=null}={}){
 const disk=new Map(),events={};let writable=true,markup="";
 const key="ekiden-manager-v1";
 if(saved!==null)disk.set(key,saved);
 const root={set innerHTML(v){markup=String(v);},get innerHTML(){return markup;}};
 const document={
  getElementById(id){if(id==="app")return root;return {value:id==="focus"?"stamina":id==="intensity"?"light":"0",files:[],click(){}};},
  addEventListener(kind,callback){events[kind]=callback;}
 };
 const storage={
  getItem(k){return disk.get(k)??null;},
  setItem(k,v){if(!writable)throw Error("test: storage quota exceeded");disk.set(k,v);}
 };
 const context=vm.createContext({document,localStorage:storage,console,Date,confirm:()=>true,setTimeout:()=>0});
 vm.runInContext(engine,context,{filename:"src/engine.js"});
 vm.runInContext(script,context,{filename:"src/app.js"});
 return {
  readonly(){writable=false;},
  stored:()=>disk.get(key),
  html:()=>markup,
  click(action){events.click({target:{closest:()=>({disabled:false,dataset:{action}})}});},
  async import(raw){
   const file={text:async()=>raw};events.change({target:{id:"savefile",files:[file]}});
   await new Promise(resolve=>setImmediate(resolve));
  }
 };
}
test("failed save after training rolls back week, cash and all roster progress",()=>{
 const ui=boot(),before=ui.stored(),old=JSON.parse(before);
 ui.readonly();ui.click("train");
 assert.equal(ui.stored(),before);
 assert.match(ui.html(),/今回の操作を取り消しました/);
 assert.match(ui.html(),new RegExp("0/12週"));
 assert.equal(JSON.parse(ui.stored()).week,old.week);
});
test("failed reset preserves original saved season even after valid training",()=>{
 const ui=boot();ui.click("train");const original=ui.stored();
 assert.equal(JSON.parse(original).week,1);
 ui.readonly();ui.click("reset");
 assert.equal(ui.stored(),original);
 assert.match(ui.html(),/元のセーブを残しています/);
 assert.match(ui.html(),/1\/12週/);
});
test("failed import keeps existing team and saved data unchanged",async()=>{
 const ui=boot();ui.click("train");const before=ui.stored();
 ui.readonly();await ui.import(JSON.stringify(JSON.parse(before)));
 assert.equal(ui.stored(),before);
 assert.match(ui.html(),/読込失敗/);
 assert.match(ui.html(),/1\/12週/);
});
test("paid-game header uses product language instead of an alpha-stage label",()=>{
 const ui=boot();assert.doesNotMatch(ui.html(),/OFFLINE ALPHA/);
 assert.match(ui.html(),/OFFLINE · JP \/ EN/);
});
