"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
function launch(){
 const store=new Map(),handlers={},fields={focus:"stamina",intensity:"light"};
 let html="";
 const root={set innerHTML(s){html=s;},get innerHTML(){return html;}};
 const doc={getElementById(id){
   if(id==="app")return root;
   return {value:fields[id]??(id.startsWith("joint-")?"hill":""),disabled:false,click(){}};
  },addEventListener(name,cb){handlers[name]=cb;}};
 const ctx=vm.createContext({document:doc,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
   console,Date,setTimeout:fn=>fn(),confirm:()=>true});
 for(const file of ["src/engine.js","src/prediction.js","src/app.js"])
  vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
 const act=op=>handlers.click({target:{closest:()=>({disabled:false,dataset:{action:op}})}});
 return {act,get state(){return JSON.parse(store.get("ekiden-manager-v1"));},get html(){return html;}};
}
test("joining practice through real UI takes money and allocates 5 points without moving the week",()=>{
 const ui=launch();
 assert.match(ui.html,/合同練習｜経験値を配分/);
 ui.act("train");
 const before=ui.state,skills=before.lineup.map(id=>before.roster.find(r=>r.id===id).stats.hill);
 ui.act("joint-practice");
 const after=ui.state;
 assert.equal(after.week,before.week);
 assert.equal(before.cash-after.cash,220000);
 assert.equal(after.jointTraining.length,1);
 assert.equal(after.ledger.filter(x=>x.kind==="合同練習費").length,1);
 after.lineup.forEach((id,i)=>assert.ok(Math.abs(after.roster.find(r=>r.id===id).stats.hill-skills[i]-1)<.001));
 ui.act("joint-practice");
 assert.equal(ui.state.jointTraining.length,1,"double click must not create second session");
 assert.match(ui.html,/今週は既に参加しています/);
});
test("season progression and selected focus remain separate from live race action",()=>{
 const ui=launch();
 assert.match(ui.html,/基礎育成期/);
 for(let i=0;i<4;i++)ui.act("train");
 assert.match(ui.html,/強化・選考期/);
 for(let i=4;i<8;i++)ui.act("train");
 assert.match(ui.html,/大会準備期/);
 for(let i=8;i<12;i++)ui.act("train");
 assert.equal(ui.state.week,12);
 assert.match(ui.html,/大会直前/);
 assert.match(ui.html,/data-action="joint-practice" disabled/);
});
