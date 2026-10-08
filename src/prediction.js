/* Virtual-only rank prediction. Fictional university clubs; no real-money payments or cashout. */
"use strict";
(()=>{
  const G=globalThis.EkidenEngine;
  if(!G)return;
  const ROUNDS=160;
  function quotes(s){
    const home=s.lineup.map(id=>s.roster.find(r=>r.id===id));
    const teams=[{name:"あなたの大学",runners:home},...s.rivalTeams.map(t=>({name:t.name,runners:G.selectRivalLineup(t).map(id=>t.roster.find(r=>r.id===id))}))];
    if(teams.some(t=>t.runners.some(r=>!r)))throw Error("出走選手不足");
    let seed=(s.year*7919+teams.reduce((a,t)=>a+t.runners.reduce((sum,r)=>sum+Math.round((r.stats.speed+r.stats.stamina+r.stats.hill)*10),0),0))>>>0;
    function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
    function normal(){return Math.sqrt(-2*Math.log(Math.max(1e-10,random())))*Math.cos(random()*2*Math.PI);}
    const counts=Object.fromEntries(teams.map(t=>[t.name,Array(8).fill(0)]));
    for(let sim=0;sim<ROUNDS;sim++){
      const ranks=teams.map(t=>{
        let total=0;
        t.runners.forEach((r,i)=>{
          const p=270.5-0.355*r.stats.speed-0.245*r.stats.stamina-(i===1?.205:i===3?.055:.115)*r.stats.hill-0.13*r.stats.grit;
          total+=(p+normal()*7.8+Math.max(0,r.fatigue-48)*.15)*G.LEGS[i].km;
        });
        return {name:t.name,total};
      }).sort((a,b)=>a.total-b.total);
      ranks.forEach((x,i)=>counts[x.name][i]++);
    }
    return teams.map(t=>({
      name:t.name,
      strength:Math.round(t.runners.reduce((n,r)=>n+(r.stats.speed+r.stats.stamina+r.stats.hill+r.stats.grit)/4,0)/5),
      ranks:counts[t.name].map((n,i)=>{
        const p=(n+1)/(ROUNDS+8);
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
