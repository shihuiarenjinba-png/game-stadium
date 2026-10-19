"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
require("../src/engine.js");
const E=globalThis.EkidenEngine;
test("ten seeded eight-season campaigns complete training, paid practice, race and final verdict",()=>{
 for(let seed=1;seed<=10;seed++){
  const s=E.newGame(seed);let practices=0;
  for(let year=1;year<=E.MAX_SEASONS;year++){
   assert.equal(s.year,year);
   for(let w=0;w<12;w++){
    E.train(s,"stamina","light");
    if(w===2&&s.cash>=2000000){
     const before=s.cash;
     E.jointPractice(s,s.lineup.map((id,i)=>({id,focus:E.SKILLS[i]})));
     assert.equal(before-s.cash,E.JOINT_COST);
     practices++;
    }
   }
   E.startRace(s);
   for(let leg=0;leg<5;leg++)E.nextLeg(s,"steady");
   assert.equal(s.race.finished,true);
   assert.doesNotThrow(()=>E.validate(JSON.parse(JSON.stringify(s))));
   if(year<E.MAX_SEASONS){
    E.closeYear(s);assert.equal(s.history.length,year);
    assert.equal(s.week,0);
   }else{
    assert.ok(["won","lost"].includes(s.ending));
    assert.throws(()=>E.closeYear(s),/最終年度/);
   }
  }
  assert.ok(practices>=1);
  assert.equal(s.year,E.MAX_SEASONS);
  assert.doesNotThrow(()=>E.validate(s));
 }
});
