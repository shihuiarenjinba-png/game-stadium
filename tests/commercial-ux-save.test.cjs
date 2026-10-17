"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
function bootWithSaved(raw){
  const map=new Map([["ekiden-manager-v1",raw]]);
  let markup="",click;
  const document={
    getElementById(id){if(id==="app")return {set innerHTML(v){markup=v;},get innerHTML(){return markup;}};return {value:"0",files:[],click(){}};},
    addEventListener(kind,fn){if(kind==="click")click=fn;}
  };
  const storage={getItem:key=>map.get(key)||null,setItem:(key,val)=>map.set(key,val)};
  const context=vm.createContext({document,localStorage:storage,console,Date,setTimeout:()=>{},confirm:()=>true});
  for(const file of ["engine.js","prediction.js","app.js"]){
    vm.runInContext(fs.readFileSync(path.join(__dirname,"..","src",file),"utf8"),context,{filename:file});
  }
  return {markup:()=>markup,stored:()=>map.get("ekiden-manager-v1"),click(action){click({target:{closest:()=>({disabled:false,dataset:{action}})}})}};
}
test("damaged save remains byte-identical until the player explicitly resets",()=>{
  const original='{"corrupt-save":not-json}';
  const game=bootWithSaved(original);
  assert.equal(game.stored(),original,"application bootstrap must not replace corrupt save");
  assert.match(game.markup(),/保存記録を安全に読み込めませんでした/);
  assert.match(game.markup(),/元のセーブをファイルに退避/);
  game.click("train");
  assert.equal(game.stored(),original,"ordinary actions must be blocked while save recovery is pending");
  game.click("reset");
  assert.notEqual(game.stored(),original,"explicitly confirmed reset should create a new save");
});
test("new player sees a stage-specific next action and progressive advanced options",()=>{
  const game=bootWithSaved(null);
  assert.match(game.markup(),/現在の目標/);
  assert.match(game.markup(),/あと12週/);
  assert.match(game.markup(),/ゲームの流れを確認する/);
  assert.match(game.markup(),/class="coach-advanced"/);
  assert.match(game.markup(),/部費・補強・他校分析・過去の結果（詳細）/);
});
