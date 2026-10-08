"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
require("../src/engine.js");
require("../src/prediction.js");
const G=globalThis.EkidenEngine,P=globalThis.EkidenPrediction;
const prepare=(seed)=>{const s=G.newGame(seed);for(let w=0;w<12;w++)G.train(s,"stamina","light");return s;};
const race=(s)=>{G.startRace(s);for(let i=0;i<15;i++)G.stepRace(s,"steady");return s;};
test("odds depend on runner skills, enumerate eight universities and eight finishing positions, and do not leak race RNG",()=>{
 const s=prepare(52),rng=s.rng,quotes=P.quotes(s);
 assert.equal(quotes.length,8);
 assert.equal(new Set(quotes.map(q=>q.name)).size,8);
 assert.ok(quotes.every(q=>q.ranks.length===8&&q.ranks.every(r=>r.odds>=1&&r.odds<=16&&r.probability>=0&&r.probability<=100&&r.sampleWins>=0&&r.sampleWins<=512&&r.range.length===2)));
 assert.equal(s.rng,rng);
 assert.deepEqual(quotes,P.quotes(s));
 assert.equal(P.SCENARIO_COUNT,512);
 assert.deepEqual(P.meta(s).samples,512);
 assert.equal(P.meta(s).rain,128);
 assert.equal(P.meta(s).dry,384);
 assert.equal(P.quotes(s),quotes,"same inputs reuse cached market, not 512 new simulations");
 assert.ok(quotes.every(q=>q.ranks.reduce((n,r)=>n+r.sampleWins,0)===512));
 assert.ok(quotes.every(q=>Math.abs(q.ranks.reduce((n,r)=>n+r.probability,0)-100)<=0.4));
 assert.ok(quotes.every(q=>q.ranks.every(r=>r.odds>=1&&r.odds<=16)));
 assert.ok(quotes.find(q=>q.name==="北稜大学").strength>quotes.find(q=>q.name==="あなたの大学").strength);
});
test("prediction stakes are debited and win/loss settles at actual rank without moving the result RNG",()=>{
 for(let seed=1;seed<=35;seed++){
   const a=prepare(seed),b=prepare(seed),cash=a.cash;
   P.place(a,"北稜大学",1,50000);
   assert.equal(a.cash,cash-50000);
   assert.equal(G.financials(a).ending,a.cash);
   assert.throws(()=>P.place(a,"あなたの大学",2,20000),/確定済み/);
   race(a);race(b);
   assert.equal(a.race.rank,b.race.rank);
   assert.deepEqual(a.race.contestants.map(x=>x.name),b.race.contestants.map(x=>x.name));
   const actual=a.race.contestants.findIndex(c=>c.name==="北稜大学")+1;
   assert.equal(a.prediction.actualRank,actual);
   assert.equal(a.prediction.status,actual===1?"won":"lost");
   assert.equal(a.prediction.payout,actual===1?Math.floor(50000*a.prediction.odds):0);
   assert.equal(G.financials(a).ending,a.cash);
   G.validate(a);
 }
});
test("fixed stake limits, pre-race window and remote-money safeguards",()=>{
 const s=G.newGame(99);
 assert.throws(()=>P.place(s,"北稜大学",1,50000),/12週/);
 for(let w=0;w<12;w++)G.train(s,"stamina","light");
 assert.throws(()=>P.place(s,"北稜大学",1,15000),/2万/);
 assert.throws(()=>P.place(s,"北稜大学",1,410000),/2万/);
 assert.throws(()=>P.place(s,"北稜大学",1,25001),/2万/);
 assert.throws(()=>P.place(s,"実在しない大学",1,50000),/大学/);
 P.place(s,"北稜大学",1,20000);
 G.startRace(s);
 assert.throws(()=>P.place(s,"北稜大学",2,50000),/大会前/);
});
test("deadline after eighth season with no championship is a game over, and early winners can still play",()=>{
 let over=0,clear=0;
 for(let seed=1;seed<=25;seed++){
   const s=G.newGame(seed);
   for(let y=1;y<=8;y++){
     for(let w=0;w<12;w++)G.train(s,"stamina","light");
     G.startRace(s);
     for(let k=0;k<15;k++)G.stepRace(s,"steady");
     if(y<8)G.closeYear(s);
   }
   assert.equal(s.year,8);
   assert.equal(s.ending,s.awards?"won":"lost");
   if(s.ending==="lost")over++;else clear++;
   assert.throws(()=>G.closeYear(s),/最終年度/);
   G.validate(s);
 }
 assert.ok(over>0);
 assert.ok(over+clear===25);
});

test("scenario bank re-prices when lineup or training differs, preserving underlying saved RNG",()=>{
 const a=prepare(712);
 const initial=P.quotes(a), before=a.rng;
 assert.equal(initial.length,8);
 assert.equal(before,a.rng);
 const swapped=[...a.lineup];
 const outsider=a.roster.find(r=>!swapped.includes(r.id));
 swapped[4]=outsider.id;
 G.setLineup(a,swapped);
 const changed=P.quotes(a);
 assert.notEqual(changed,initial,"different lineup invalidates odds cache");
 assert.equal(a.rng,before,"pricing must not alter actual race noise");
 assert.deepEqual(changed,P.quotes(a),"same lineup caches");
});
test("virtual forecast outcomes are never affected by betting or not betting",()=>{
 for(let seed=41;seed<=48;seed++){
   const noBet=prepare(seed),bet=JSON.parse(JSON.stringify(noBet));
   P.place(bet,"北稜大学",1,30000);
   assert.equal(bet.cash,noBet.cash-30000);
   race(noBet);race(bet);
   assert.deepEqual(bet.race.contestants.map(c=>[c.name,c.total]),noBet.race.contestants.map(c=>[c.name,c.total]));
   assert.equal(G.financials(bet).ending,bet.cash);
 }
});
test("even favorite placement at 1.0x cannot generate positive net gain",()=>{
 let found=null;
 for(let seed=1;seed<=16&&!found;seed++){
   const s=prepare(seed);
   const q=P.quotes(s);
   const mark=q.flatMap(t=>t.ranks.map(r=>({team:t.name,rank:r.rank,odds:r.odds}))).find(x=>x.odds===1);
   if(mark)found={s,mark};
 }
 assert.ok(found,"some extreme favorites should be priced at 1.0x");
 const {s,mark}=found;
 P.place(s,mark.team,mark.rank,20000);
 race(s);
 const ticketNet=s.prediction.payout-s.prediction.stake;
 assert.ok(ticketNet<=0,"a 1.0x favorite can at best return the stake");
 G.validate(s);
});
