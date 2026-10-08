/* Virtual-only rank prediction. Fictional university clubs; no real-money payments or cashout. */
"use strict";
(()=>{
  const G=globalThis.EkidenEngine;
  if(!G)return;
  const ROUNDS=160;
  function quotes(s){
    if(s.race||s.week!==12)throw Error("順位予想は大会直前のみ表示します");
    const teams=[{name:"あなたの大学",runners:s.lineup.map(id=>s.roster.find(r=>r.id===id))},
      ...s.rivalTeams.map(t=>({name:t.name,runners:G.selectRivalLineup(t).map(id=>t.roster.find(r=>r.id===id))}))];
    if(teams.some(t=>t.runners.some(r=>!r)))throw Error("出走選手が不足しています");
    const counts=Object.fromEntries(teams.map(t=>[t.name,Array(8).fill(0)]));
    const rounds=160;
    // Forecasts run the SAME simulation engine as the actual race, but only on cloned games.
    // Seeds are independent from s.rng, so no prediction changes or exposes the live outcome.
    const fingerprint=teams.reduce((n,t)=>n+t.runners.reduce((a,r)=>a+Math.round((r.stats.speed+r.stats.stamina+r.stats.hill+r.stats.grit)*10),0),s.year*117593);
    let salt=(Math.imul(fingerprint|0,1664525)+1013904223)>>>0;
    for(let k=0;k<rounds;k++){
      salt=(Math.imul(salt,1664525)+1013904223)>>>0;
      const clone=JSON.parse(JSON.stringify(s));
      clone.rng=(salt^0x9E3779B9)>>>0;
      clone.prediction=null;
      G.startRace(clone);
      // Representative default strategy: conserve first, steady middle, push final checkpoint.
      for(let step=0;step<15;step++)G.stepRace(clone,step%3===0?"save":step%3===1?"steady":"push");
      clone.race.contestants.forEach((c,rank)=>counts[c.name][rank]++);
    }
    return teams.map(t=>({
      name:t.name,
      strength:Math.round(t.runners.reduce((n,r)=>n+(r.stats.speed+r.stats.stamina+r.stats.hill+r.stats.grit)/4,0)/5),
      ranks:counts[t.name].map((n,i)=>{
        const p=(n+1)/(rounds+8);
        return {rank:i+1,probability:Number((p*100).toFixed(1)),odds:Math.max(1.1,Math.min(16,Math.floor(.78/p*10)/10))};
      })
    }));
  }
  function place(s,team,rank,stake){
    if(s.ending)throw Error("ゲームは終了しています");
    if(s.week!==12||s.race)throw Error("予想は育成12週終了後、大会前に限ります");
    if(s.prediction)throw Error("今季の予想は確定済みです");
    if(!Number.isInteger(rank)||rank<1||rank>8||!Number.isSafeInteger(stake)||stake<20000||stake>400000||stake%10000!==0)throw Error("金額は2万〜40万円、1万円刻みで設定してください");
    const entry=quotes(s).find(x=>x.name===team);
    if(!entry)throw Error("大学を選んでください");
    if(s.cash-stake<480000)throw Error("大会遠征費48万円を残してください");
    const line=entry.ranks[rank-1];
    s.cash-=stake;s.ledger.push({year:s.year,week:s.week,amount:-stake,kind:"架空順位予想支出",label:team+" "+rank+"位"});
    s.prediction={year:s.year,team,rank,stake,odds:line.odds,probability:line.probability,status:"placed",payout:0};
    s.lastLog=team+"の"+rank+"位を予想。部費から"+stake.toLocaleString("ja-JP")+"円を支出しました。";
    return s;
  }
  function settle(s){
    const p=s.prediction;
    if(!p||p.status!=="placed")return s;
    const actual=s.race.contestants.findIndex(c=>c.name===p.team)+1;
    p.actualRank=actual;p.status=actual===p.rank?"won":"lost";
    p.payout=p.status==="won"?Math.floor(p.stake*p.odds):0;
    if(p.payout){s.cash+=p.payout;s.ledger.push({year:s.year,week:s.week,amount:p.payout,kind:"架空順位予想収入",label:p.team+" "+p.rank+"位 的中"});}
    return s;
  }
  globalThis.EkidenPrediction={quotes,place,settle};
})();
