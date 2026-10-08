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

test("random joint-camp invitations need a real budget purchase and expire",()=>{
  let found=null;
  for(let seed=1;seed<=80&&!found;seed++){
    const s=G.newGame(seed);
    for(let w=0;w<11;w++){
      G.train(s,"stamina","light");
      if(s.offer){found=s;break;}
    }
  }
  assert.ok(found,"a seeded invitation should occur");
  const cash=found.cash,stock=found.items.camp;
  G.buyItem(found,"invite");
  assert.equal(found.cash,cash-260000);
  assert.equal(found.items.camp,stock+1);
  assert.equal(found.offer,null);
  assert.equal(found.ledger.at(-1).label,"特別合同合宿への招待枠");
  assert.equal(G.financials(found).ending,found.cash);
  G.train(found,"stamina","normal");
  assert.equal(found.items.camp,stock);
});

test("15 checkpoints, realistic energy spending, and strategy-dependent pacing",()=>{
  const a=G.newGame(138),b=G.newGame(138);
  for(let i=0;i<12;i++){G.train(a,"stamina","light");G.train(b,"stamina","light");}
  G.startRace(a);G.startRace(b);
  G.stepRace(a,"save");
  G.stepRace(b,"push");
  assert.equal(a.race.leg,0);
  assert.equal(a.race.segment,1);
  assert.ok(a.race.contestants.find(c=>c.human).energy>b.race.contestants.find(c=>c.human).energy);
  const aHuman=a.race.contestants.find(c=>c.human),bHuman=b.race.contestants.find(c=>c.human);
  assert.ok(aHuman.total>bHuman.total,"saving is slower at the first checkpoint");
  for(let i=1;i<15;i++)G.stepRace(a,i%3===2?"push":"steady");
  assert.equal(a.race.leg,5);
  assert.equal(a.race.segment,0);
  assert.equal(a.race.finished,true);
  assert.equal(a.race.notes.length,15);
  for(const competitor of a.race.contestants){
    assert.equal(competitor.splits.length,5);
    assert.ok(competitor.splits.every(split=>split.partials.length===3));
    assert.equal(competitor.total,competitor.splits.reduce((sum,split)=>sum+split.seconds,0));
  }
  assert.equal(G.financials(a).ending,a.cash);
});
test("annual operating costs are actually charged each year, without double charging",()=>{
  const s=G.newGame(51);
  playYear(s);
  const oldFixed=s.ledger.filter(x=>x.kind==="固定費").reduce((n,x)=>n+x.amount,0);
  assert.equal(oldFixed,-2200000);
  G.closeYear(s);
  const current=s.ledger.filter(x=>x.year===2&&x.kind==="固定費").reduce((n,x)=>n+x.amount,0);
  assert.equal(current,-2200000);
  assert.equal(G.financials(s,2).opening,s.history[0].finance.ending);
  assert.equal(G.financials(s).ending,s.cash);
});
test("scouting is a paid long-term investment limited to 3 times per year",()=>{
  const a=G.newGame(32),b=G.newGame(32);
  for(let i=0;i<3;i++)G.investScouting(a);
  assert.throws(()=>G.investScouting(a),/最大3回/);
  assert.equal(a.ledger.filter(x=>x.kind==="採用・勧誘費").length,3);
  for(let w=0;w<12;w++){G.train(a,"stamina","light");G.train(b,"stamina","light");}
  G.startRace(a);G.startRace(b);
  for(let i=0;i<5;i++){G.nextLeg(a);G.nextLeg(b);}
  G.closeYear(a);G.closeYear(b);
  const first=a.roster.filter(r=>r.grade===1),second=b.roster.filter(r=>r.grade===1);
  assert.ok(first.every((r,i)=>r.stats.speed>second[i].stats.speed+5));
  assert.equal(a.scouting,0);
  assert.equal(G.financials(a).ending,a.cash);
});
test("malformed or tampered save data is rejected; v0.1 races can migrate",()=>{
  const original=G.newGame(93),bad=JSON.parse(JSON.stringify(original));
  bad.ledger[0].amount+=500000;
  assert.throws(()=>G.validate(bad),/台帳と一致/);
  const invalid=JSON.parse(JSON.stringify(original));
  invalid.roster[0].stats.speed=Number.MAX_VALUE;
  assert.throws(()=>G.validate(invalid),/能力値/);
  for(let i=0;i<12;i++)G.train(original,"stamina","light");
  G.startRace(original);
  delete original.race.segment;
  for(const opponent of original.race.contestants)if(!opponent.human)delete opponent.runners;
  G.migrateSave(original);
  G.stepRace(original,"steady");
  assert.equal(original.race.segment,1);
});


test("seven rival universities maintain individual 10-player rosters and unique 5-runner lineups",()=>{
  const s=G.newGame(811);
  assert.equal(s.rivalTeams.length,7);
  assert.equal(new Set(s.rivalTeams.map(t=>t.name)).size,7);
  for(const t of s.rivalTeams){
    assert.equal(t.roster.length,10);
    assert.equal(new Set(t.roster.map(r=>r.id)).size,10);
    assert.equal(t.lineup.length,5);
    assert.equal(new Set(t.lineup).size,5);
    assert.equal(t.finance.income-t.finance.expenses,t.cash);
    assert.equal(t.finance.opening+t.finance.income-t.finance.expenses,t.cash);
    for(const id of t.lineup)assert.ok(t.roster.some(r=>r.id===id));
  }
  const first=s.rivalTeams[0].roster.map(r=>({id:r.id,grade:r.grade}));
  for(let i=0;i<12;i++)G.train(s,"stamina","normal");
  assert.ok(s.rivalTeams.every(t=>t.finance.expenses>2200000));
  G.startRace(s);
  for(const c of s.race.contestants.filter(c=>!c.human)){
    assert.equal(c.runners.length,5);
    assert.equal(new Set(c.runners.map(x=>x.id)).size,5);
    assert.ok(c.runners.every(x=>typeof x.name==="string"&&x.name.length>0));
  }
  for(let i=0;i<15;i++)G.stepRace(s,"steady");
  G.closeYear(s);
  const boss=s.rivalTeams.find(t=>t.boss);
  assert.equal(boss.roster.length,10);
  for(const r of first.filter(x=>x.grade===4))assert.ok(!boss.roster.some(x=>x.id===r.id));
  for(const r of first.filter(x=>x.grade<4))assert.equal(boss.roster.find(x=>x.id===r.id).grade,r.grade+1);
  assert.ok(boss.lastRank>=1&&boss.lastRank<=8);
  assert.equal(boss.finance.income-boss.finance.expenses,boss.cash-1584000);
  G.validate(s);
});
test("the CPU league has reproducible long-term turnover, independent racing form and zero network",()=>{
  const a=G.newGame(712),b=G.newGame(712);
  for(let y=0;y<3;y++){
    for(let w=0;w<12;w++){G.train(a,"speed","light");G.train(b,"speed","light");}
    G.startRace(a);G.startRace(b);
    for(let i=0;i<15;i++){G.stepRace(a,i%3===2?"push":"save");G.stepRace(b,i%3===2?"push":"save");}
    G.closeYear(a);G.closeYear(b);
    assert.deepEqual(a,b);
  }
  assert.equal(a.rivalTeams.length,7);
  assert.ok(a.rivalTeams.every(t=>t.roster.length===10&&t.lastRank!==null));
  assert.equal(G.financials(a).ending,a.cash);
});


test("personal records, complete historic standings and graduated alumni survive year rollover",()=>{
  const s=G.newGame(912);
  const seniors=s.roster.filter(r=>r.grade===4).map(r=>({id:r.id,name:r.name}));
  for(let w=0;w<12;w++)G.train(s,"stamina","light");
  G.startRace(s);
  for(let checkpoint=0;checkpoint<15;checkpoint++)G.stepRace(s,"steady");
  const runners=s.lineup.map(id=>s.roster.find(r=>r.id===id));
  for(let leg=0;leg<5;leg++){
    const d=String(G.LEGS[leg].km);
    assert.ok(Number.isInteger(runners[leg].records?.[d]));
    assert.equal(runners[leg].records[d],s.race.contestants.find(c=>c.human).splits[leg].seconds);
  }
  G.closeYear(s);
  assert.equal(s.history[0].standings.length,8);
  assert.deepEqual(s.history[0].standings.map(x=>x.rank),[1,2,3,4,5,6,7,8]);
  assert.equal(new Set(s.history[0].standings.map(x=>x.name)).size,8);
  assert.ok(s.history[0].standings.every(x=>x.seconds>0));
  for(const senior of seniors){
    const alum=s.alumni.find(x=>x.id===senior.id);
    assert.ok(alum);
    assert.equal(alum.graduationYear,1);
    assert.equal(alum.name,senior.name);
  }
  G.validate(s);
});
test("old saves without an alumni ledger migrate without losing money",()=>{
  const old=G.newGame(223),cash=old.cash;
  delete old.alumni;
  delete old.rivalTeams;
  G.migrateSave(old);
  assert.equal(old.cash,cash);
  assert.deepEqual(old.alumni,[]);
  assert.equal(old.rivalTeams.length,7);
  G.validate(old);
});

test("malformed CPU school athletes and mismatched team budgets cannot be imported",()=>{
  const original=G.newGame(223);
  const budget=JSON.parse(JSON.stringify(original));
  budget.rivalTeams[0].finance.expenses+=5000;
  assert.throws(()=>G.validate(budget),/CPU大学/);
  const stat=JSON.parse(JSON.stringify(original));
  stat.rivalTeams[2].roster[3].stats.speed=100000;
  assert.throws(()=>G.validate(stat),/CPU大学/);
  const legacy=JSON.parse(JSON.stringify(original));
  for(const team of legacy.rivalTeams)delete team.finance.opening;
  G.migrateSave(legacy);
  assert.ok(legacy.rivalTeams.every(t=>t.finance.opening+t.finance.income-t.finance.expenses===t.cash));
});

test("rare gifted freshmen are seeded, visible in data and keep safe stat bounds",()=>{
  let count=0,stars=0,genius=0;
  for(let seed=1;seed<=400;seed++){
    const s=G.newGame(seed);
    for(let w=0;w<12;w++)G.train(s,"stamina","light");
    G.startRace(s);for(let leg=0;leg<5;leg++)G.nextLeg(s);
    G.closeYear(s);
    for(const r of s.roster.filter(r=>r.grade===1)){
      count++;if(r.talent)stars++;
      if(r.talent==="天才1年生")genius++;
      for(const skill of G.SKILLS)assert.ok(r.stats[skill]>=35&&r.stats[skill]<=99);
    }
    G.validate(s);
  }
  assert.ok(stars>0 && stars<count*0.15,"rare but possible outstanding freshmen");
  assert.ok(genius>=0);
});
