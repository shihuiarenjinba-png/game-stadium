"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
require("../src/engine.js");
const G=globalThis.EkidenEngine;
const playYear=(s,{focus=["stamina","speed","hill","grit"],camp=true}={})=>{
  for(let w=0;w<12;w++){if(w===0&&camp&&s.cash>1800000)G.buyItem(s,"camp");G.train(s,focus[w%focus.length],"normal");}
  G.startRace(s);for(let i=0;i<5;i++)G.nextLeg(s,"steady");return s.race.rank;
};
test("new game starts with 10 runners and balanced prepaid annual accounts",()=>{
  const s=G.newGame(123);
  assert.equal(s.roster.length,10);
  assert.equal(s.cash,2400000);
  assert.equal(G.financials(s).ending,s.cash);
  assert.equal(G.financials(s).income,4600000);
  assert.equal(G.financials(s).expenses,2200000);
});
test("a purchased camp doubles selected runners training gain and is booked",()=>{
  const a=G.newGame(454), b=G.newGame(454);
  const id=a.lineup[0], ra=a.roster.find(r=>r.id===id), rb=b.roster.find(r=>r.id===id);
  const va=ra.stats.stamina,vb=rb.stats.stamina;
  G.buyItem(a,"camp");
  G.train(a,"stamina","normal");G.train(b,"stamina","normal");
  assert.ok(ra.stats.stamina-va > (rb.stats.stamina-vb)*1.7);
  assert.equal(a.items.camp,0);
  assert.equal(a.ledger.find(x=>x.label==="強化合宿").amount,-420000);
});
test("race has 8 teams, unique athletes per section, live progress and senior clutch",()=>{
  const s=G.newGame(943);assert.throws(()=>G.setLineup(s,[1,1,2,3,4]),/異なる選手/);
  const ranks=[];
  playYear(s);
  assert.equal(s.race.contestants.length,8);
  assert.equal(s.race.leg,5);
  assert.equal(s.race.finished,true);
  assert.ok(s.race.rank>=1 && s.race.rank<=8);
  for(const c of s.race.contestants)assert.equal(c.splits.length,5);
  assert.equal(G.financials(s).ending,s.cash);
});
test("year closing uses no double-counted expense; seniors graduate, newcomers arrive",()=>{
  const s=G.newGame(77);const oldIds=s.roster.filter(x=>x.grade===4).map(x=>x.id);playYear(s);const report=G.financials(s);G.closeYear(s);
  assert.equal(s.history[0].finance.ending,report.ending);
  assert.equal(s.history[0].rank>=1,true);
  assert.equal(s.roster.length,10);
  for(const id of oldIds)assert.ok(!s.roster.some(x=>x.id===id));
  assert.equal(s.year,2);
  assert.equal(G.financials(s).ending,s.cash);
});
test("deterministic save and continuation",()=>{
  const a=G.newGame(808),b=JSON.parse(JSON.stringify(a));G.validate(b);
  G.buyItem(a,"science");G.buyItem(b,"science");
  G.train(a,"hill","hard");G.train(b,"hill","hard");
  assert.deepEqual(a,b);
});
test("budget reserve prevents overspending the remaining minimum practices and travel",()=>{
  const s=G.newGame(3);
  for(let k=0;k<2;k++)G.buyItem(s,"camp");
  for(let k=0;k<2;k++)G.buyItem(s,"science");
  G.buyItem(s,"recovery");
  assert.throws(()=>G.buyItem(s,"rain"),/最低練習費/);
  for(let i=0;i<12;i++)G.train(s,"stamina","light");
  assert.ok(s.cash>=480000);
  G.startRace(s);
  assert.ok(s.cash>=0);
});
test("boss remains dominant in early years but becomes beatable after several cycles",()=>{
  const n=500,first=[0,0,0,0,0,0],boss=[0,0,0,0,0,0],ranks=[0,0,0,0,0,0];
  for(let seed=1;seed<=n;seed++){
    const s=G.newGame(seed);
    for(let y=0;y<6;y++){
      const rank=playYear(s);
      if(rank===1)first[y]++;
      if(s.race.contestants[0].name==="北稜大学")boss[y]++;
      ranks[y]+=rank;
      assert.equal(G.financials(s).ending,s.cash);
      G.closeYear(s);
    }
  }
  assert.ok(boss[0]/n>=0.7);
  assert.ok(first[0]/n<0.05);
  assert.ok(first[4]/n>=0.1);
  assert.ok(first[5]/n>=0.25);
  assert.ok(ranks[5]<ranks[0]);
});
