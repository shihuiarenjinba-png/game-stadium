/* Virtual-only rank forecasting; deliberately no real-money exchange, network or redemption. */
"use strict";
(()=>{
  const G=globalThis.EkidenEngine;
  if(!G)return;
  const SAMPLES=512, RAIN_SAMPLES=128, HOUSE_FACTOR=.78, MAX_ODDS=16;
  let cachedSignature=null,cachedQuotes=null,cachedMeta=null;
  function serializeTeams(s){
    const teams=[{name:"あなたの大学",runners:s.lineup.map(id=>s.roster.find(r=>r.id===id))},
      ...s.rivalTeams.map(t=>({name:t.name,runners:G.selectRivalLineup(t).map(id=>t.roster.find(r=>r.id===id))}))];
    if(teams.some(t=>t.runners.some(r=>!r)))throw Error("出走選手不足");
    return teams;
  }
  function fingerprint(s,teams){
    // Every input that affects the quoted forecast must be part of the key.
    return JSON.stringify({year:s.year,week:s.week,rainEquipment:s.items.rain,
      teams:teams.map(t=>({name:t.name,runners:t.runners.map(r=>({
        id:r.id,grade:r.grade,stats:r.stats,fatigue:r.fatigue,morale:r.morale,
        traits:r.traits||null,clutch:r.clutch||null
      }))}))});
  }
  function hash(input){
    let h=2166136261>>>0;
    for(let i=0;i<input.length;i++){h=Math.imul(h^input.charCodeAt(i),16777619)>>>0;}
    return h||1;
  }
  function scenarioBank(key){
    // 512 preselected deterministic scenario seeds: 384 dry + 128 rainy.
    // Stratified weather avoids misleading odds from short, unusually wet samples.
    // Other randomness (athlete form, falls in pace, morale, senior grit) still comes
    // from the exact same engine as the actual race.
    let x=(hash(key)^0xA57D3C1F)>>>0;
    const seen=new Set(),result=[],totals={rain:0,dry:0};
    for(let i=0;i<SAMPLES;i++){
      const target=i%4===0?"rain":"dry";
      let seed;
      do{
        x=(Math.imul(1664525,x)+1013904223)>>>0;
        seed=(x^0x9E3779B9)>>>0;
      }while(seen.has(seed)||(((((Math.imul(1664525,seed)+1013904223)>>>0)/4294967296)<.25)!==(target==="rain")));
      seen.add(seed);totals[target]++;result.push({seed,weather:target});
    }
    if(totals.rain!==RAIN_SAMPLES||totals.dry!==SAMPLES-RAIN_SAMPLES)throw Error("シナリオ配分に失敗しました");
    return result;
  }
  function distribution(s,teams,key){
    const counts=Object.fromEntries(teams.map(t=>[t.name,Array(8).fill(0)]));
    const scenarios=scenarioBank(key);
    const seasonJSON=JSON.stringify(s);
    for(const sample of scenarios){
      const clone=JSON.parse(seasonJSON);
      clone.rng=sample.seed;
      clone.prediction=null;
      G.startRace(clone);
      if((clone.race.weather==="雨")!==(sample.weather==="rain"))throw Error("シナリオの天候が不整合です");
      for(let step=0;step<15;step++)G.stepRace(clone,step%3===0?"save":step%3===1?"steady":"push",clone.cash>=G.WATER_COST?1:0);
      clone.race.contestants.forEach((c,rank)=>counts[c.name][rank]++);
    }
    return counts;
  }
  function oddsFor(p){
    // Extremely likely placements yield <=1.0x instead of guaranteed positive EV.
    // Low-probability events are capped to prevent runaway club-fund payouts.
    return Math.max(1,Math.min(MAX_ODDS,Math.floor(HOUSE_FACTOR/p*10)/10));
  }
  function uncertainty(successes,total){
    // Wilson 95% interval: quantifies Monte Carlo uncertainty, not model accuracy.
    const z=1.96,p=successes/total,z2=z*z,d=1+z2/total;
    const center=(p+z2/(2*total))/d;
    const half=z*Math.sqrt(p*(1-p)/total+z2/(4*total*total))/d;
    return [Number((100*Math.max(0,center-half)).toFixed(1)),Number((100*Math.min(1,center+half)).toFixed(1))];
  }
  function quotes(s){
    if(s.race||s.week!==12||s.ending)throw Error("順位予想は大会直前のみ表示します");
    const teams=serializeTeams(s),key=fingerprint(s,teams);
    if(key===cachedSignature && cachedQuotes)return cachedQuotes;
    const counts=distribution(s,teams,key);
    const data=teams.map(t=>({
      name:t.name,
      strength:Math.round(t.runners.reduce((n,r)=>n+(r.stats.speed+r.stats.stamina+r.stats.hill+r.stats.grit)/4,0)/5),
      ranks:counts[t.name].map((count,i)=>{
        const raw=count/SAMPLES;
        // Smoothing is used only for price computation, never for displayed empirical rate.
        const smoothed=(count+1)/(SAMPLES+8);
        const interval=uncertainty(count,SAMPLES);
        return {rank:i+1,probability:Number((raw*100).toFixed(1)),range:interval,
          odds:oddsFor(smoothed),sampleWins:count};
      })
    }));
    cachedSignature=key;cachedQuotes=data;
    cachedMeta={samples:SAMPLES,rain:RAIN_SAMPLES,dry:SAMPLES-RAIN_SAMPLES,
      policy:"区間前半は温存・中盤は標準・終盤は攻め。給水は各地点1杯（予算不足時は0杯）",method:"同じレースエンジンで512通り試算（晴384・雨128）"};
    return data;
  }
  function meta(s){
    quotes(s);
    return {...cachedMeta};
  }
  function place(s,team,rank,stake){
    if(s.ending)throw Error("ゲームは終了しています");
    if(s.week!==12||s.race)throw Error("予想は育成12週終了後、大会前に限ります");
    if(s.prediction)throw Error("今季の予想は確定済みです");
    if(!Number.isInteger(rank)||rank<1||rank>8||!Number.isSafeInteger(stake)||stake<20000||stake>400000||stake%10000!==0)throw Error("金額は2万〜40万円、1万円刻みで設定してください");
    if(s.cash-stake<480000)throw Error("大会遠征費48万円を残してください");
    const entry=quotes(s).find(x=>x.name===team);
    if(!entry)throw Error("大学を選んでください");
    const line=entry.ranks[rank-1];
    // Revalidate both balance and quote before any side effects.
    s.cash-=stake;
    s.ledger.push({year:s.year,week:s.week,amount:-stake,kind:"架空順位予想支出",label:team+" "+rank+"位"});
    s.prediction={year:s.year,team,rank,stake,odds:line.odds,probability:line.probability,
      scenarioCount:SAMPLES,range:line.range,status:"placed",payout:0};
    s.lastLog=team+"の"+rank+"位を予想。部費から"+stake.toLocaleString("ja-JP")+"円を支出しました。";
    return s;
  }
  function settle(s){
    const p=s.prediction;
    if(!p||p.status!=="placed")return s;
    const actual=s.race.contestants.findIndex(c=>c.name===p.team)+1;
    if(actual<1||actual>8)throw Error("予想対象大学の結果がありません");
    const paid=actual===p.rank?Math.floor(p.stake*p.odds):0;
    if(!Number.isSafeInteger(paid)||paid<0||paid>6400000)throw Error("不正な払戻し金額です");
    p.actualRank=actual;p.status=actual===p.rank?"won":"lost";
    p.payout=paid;
    if(paid){s.cash+=paid;s.ledger.push({year:s.year,week:s.week,amount:paid,kind:"架空順位予想収入",label:p.team+" "+p.rank+"位 的中"});}
    return s;
  }
  globalThis.EkidenPrediction={quotes,meta,place,settle,SCENARIO_COUNT:SAMPLES};
})();
