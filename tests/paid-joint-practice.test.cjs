"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
require("../src/engine.js");
const G=globalThis.EkidenEngine;
const alloc=s=>s.lineup.map((id,i)=>({id,focus:G.SKILLS[i]}));
test("paid joint session assigns exactly five fixed points and records expense once",()=>{
 const s=G.newGame(33);
 assert.throws(()=>G.jointPractice(s,alloc(s)),/第1〜11週/);
 G.train(s,"stamina","light");
 const people=s.lineup.map(id=>s.roster.find(r=>r.id===id));
 const before=people.map((r,i)=>({stat:r.stats[G.SKILLS[i]],fatigue:r.fatigue,morale:r.morale}));
 const week=s.week,cash=s.cash,ledger=s.ledger.length;
 G.jointPractice(s,alloc(s));
 assert.equal(s.week,week,"optional extra session must not skip a week");
 assert.equal(cash-s.cash,G.JOINT_COST);
 assert.equal(s.ledger.length,ledger+1);
 assert.equal(s.jointTraining.length,1);
 people.forEach((r,i)=>{
   assert.ok(Math.abs((r.stats[G.SKILLS[i]]-before[i].stat)-1)<.0001);
   assert.equal(r.fatigue,Math.min(100,before[i].fatigue+5));
   assert.equal(r.morale,Math.min(100,before[i].morale+2));
 });
 assert.equal(s.jointTraining[0].allocations.length,5);
 assert.equal(G.financials(s).ending,s.cash);
 assert.equal(G.validate(JSON.parse(JSON.stringify(s))),true);
});
test("cannot double buy in one week, exceed annual cap, or use third party/duplicate athletes",()=>{
 const s=G.newGame(51);
 G.train(s,"grit","normal");
 const original=JSON.stringify(s);
 assert.throws(()=>G.jointPractice(s,alloc(s).map((a,i)=>i===4?{id:999,focus:"speed"}:a)),/選抜/);
 assert.equal(JSON.stringify(s),original,"invalid attendance must not mutate financial ledger");
 G.jointPractice(s,alloc(s));const after=JSON.stringify(s);
 assert.throws(()=>G.jointPractice(s,alloc(s)),/同じ週/);
 assert.equal(JSON.stringify(s),after);
 G.train(s,"speed","light");G.jointPractice(s,alloc(s));
 for(let k=0;k<2;k++)G.train(s,"hill","light");
 assert.throws(()=>G.jointPractice(s,alloc(s)),/2回/);
 assert.equal(s.jointTraining.length,2);
});
test("reserve funds and old save compatibility are preserved",()=>{
 const s=G.newGame(87);
 delete s.jointTraining;
 assert.equal(G.validate(s),true);
 G.migrateSave(s);
 assert.deepEqual(s.jointTraining,[]);
 G.train(s,"stamina","light");
 const saved=JSON.parse(JSON.stringify(s));const prohibited=alloc(s);
 s.cash=100000;
 // Cash must equal ledger before persisted validation, but direct action still protects reserved funds.
 assert.throws(()=>G.jointPractice(s,prohibited),/残りの練習費/);
 assert.equal(s.jointTraining.length,0);
 assert.equal(G.validate(saved),true);
});
test("year closing keeps prior joint sessions and allows the new season's own allowance",()=>{
 const s=G.newGame(91);G.train(s,"stamina","light");G.jointPractice(s,alloc(s));
 while(s.week<12)G.train(s,"stamina","light");
 G.startRace(s);
 for(let i=0;i<5;i++)G.nextLeg(s,"steady");
 G.closeYear(s);
 assert.equal(s.year,2);assert.equal(s.week,0);
 assert.equal(s.jointTraining.length,1);
 G.train(s,"speed","light");G.jointPractice(s,alloc(s));
 assert.equal(s.jointTraining.length,2);
 assert.equal(G.validate(s),true);
});
