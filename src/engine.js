// EKIDEN MANAGER — pure simulation engine. No network or external dependencies.
const SKILLS=["speed","stamina","hill","grit","recovery"];
const LEGS=[{"km":8,"title":"1区・平坦"},{"km":10,"title":"2区・登坂"},{"km":12,"title":"3区・持久戦"},{"km":8,"title":"4区・下り"},{"km":12,"title":"5区・最終勝負"}];
const SHOP={"camp":{"name":"強化合宿","cost":420000,"desc":"次の1回、出走予定5人の対象能力成長を2倍。疲労増加あり"},"science":{"name":"フォーム・乳酸測定","cost":160000,"desc":"次の1回、出走予定5人の対象能力成長を1.35倍"},"recovery":{"name":"栄養・リカバリー支援","cost":150000,"desc":"全部員の疲労を軽減し、士気を改善"},"rain":{"name":"雨天用シューズ・備品","cost":240000,"desc":"次大会1回、雨天時のペース低下を緩和"}};
const RIVALS=[{"name":"北稜大学","base":86.5,"boss":true},{"name":"東央大学","base":80.5},{"name":"西峰大学","base":77.8},{"name":"海風大学","base":74.4},{"name":"栄進大学","base":71.8},{"name":"緑ヶ丘大学","base":68.8},{"name":"南都大学","base":66}];
const NAMES=["佐藤 智也","田中 陸","山本 駿","伊藤 悠","鈴木 健人","高橋 湊","小林 蒼","渡辺 悠人","中村 大地","加藤 陽太","森 蓮","山口 碧","井上 歩","石川 颯","松本 悠真","清水 仁","前田 航"];

function random(s){s.rng=(Math.imul(1664525,s.rng>>>0)+1013904223)>>>0; return s.rng/4294967296}

function between(s,a,b){return a+(b-a)*random(s)}

function normal(s){let a=Math.max(1e-10,random(s)),b=random(s);return Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*b)}

function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n))}

function addMoney(s,amount,kind,label){if(amount<0 && s.cash+amount<0)throw Error("部費残高が不足しています");s.cash+=amount;s.ledger.push({year:s.year,week:s.week,amount,kind,label});}

function makeRunner(s,name,grade,id){let level=54+grade*4+(grade===1?Math.min(14,(s.year-1)*3.3):0)+between(s,-5,9);let x={id,name,grade,fatigue:between(s,6,18),morale:between(s,60,86),traits:{clutch:between(s,0,1),hill:between(s,-5,5)},stats:{}};for(const k of SKILLS)x.stats[k]=Math.round(clamp(level+between(s,-7,7),35,90)*10)/10;return x}

function newGame(seed=20261008){let s={version:1,year:1,week:0,rng:(seed>>>0)||1,cash:0,roster:[],lineup:[],ledger:[],history:[],items:{camp:0,science:0,recovery:0,rain:0},offer:null,race:null,lastLog:"創部1年目。全国駅伝の絶対王者・北稜大学に挑戦します。",awards:0};for(let i=0;i<10;i++){let grade=i<2?4:i<5?3:i<8?2:1;s.roster.push(makeRunner(s,NAMES[i],grade,i+1));}s.lineup=s.roster.slice(0,5).map(r=>r.id);addMoney(s,4000000,"収入","大学からの年間部費配分");addMoney(s,600000,"収入","OB・OG会の年間活動支援");addMoney(s,-2200000,"固定費","年間運営経費（施設・保険・指導補助・用具）");return s}

function validate(s){if(!s||s.version!==1||!Array.isArray(s.roster)||!Array.isArray(s.ledger)||!Number.isFinite(s.cash))throw Error("セーブデータが不正です");if(s.cash<0)throw Error("部費残高が不正です");return true}

function setLineup(s,ids){if(s.race)throw Error("大会開催中は区間配置を変更できません");if(!Array.isArray(ids)||ids.length!==5||new Set(ids.map(Number)).size!==5||ids.some(id=>!s.roster.some(r=>r.id===Number(id))))throw Error("異なる選手を5名選んでください");s.lineup=ids.map(Number);return s}

function buyItem(s,key){if(s.race||s.week>=12)throw Error("大会前の練習期間のみ購入できます");let special=key==="invite";let item=special&&s.offer&&s.week<=s.offer.expires?{name:"特別合同合宿への招待枠",cost:260000}:SHOP[key];if(!item)throw Error("その備品はありません");let stockKey=special?"camp":key;if(key!=="recovery" && s.items[stockKey]>=2)throw Error("同一アイテムの保管上限は2個です");if(s.cash-item.cost<480000+(12-s.week)*38000)throw Error("残りの最低練習費と大会遠征費を確保してください");addMoney(s,-item.cost,"購入費",item.name);if(key==="recovery"){for(const r of s.roster){r.fatigue=clamp(r.fatigue-23,0,100);r.morale=clamp(r.morale+6,0,100);}s.lastLog="栄養・回復支援により疲労を軽減しました。";}else{s.items[stockKey]++;if(special)s.offer=null;s.lastLog=item.name+"を購入しました（次回の対象機会に使用）。";}return s}

function train(s,focus="stamina",intensity="normal"){if(s.race)throw Error("大会開催中です");if(s.week>=12)throw Error("練習期間が終了しました。大会へ進んでください");if(!SKILLS.includes(focus))throw Error("能力値が不正です");if(!["light","normal","hard"].includes(intensity))throw Error("練習強度が不正です");let cost={light:38000,normal:72000,hard:110000}[intensity], factor={light:0.65,normal:1,hard:1.35}[intensity],fatigue={light:2,normal:6,hard:12}[intensity];if(s.cash-cost<480000+(11-s.week)*38000)throw Error("残りの最低練習費と大会遠征費を確保してください");addMoney(s,-cost,"練習費",["調整練習","通常練習","高強度練習"][["light","normal","hard"].indexOf(intensity)]);let camp=s.items.camp>0,science=s.items.science>0;if(camp)s.items.camp--;if(science)s.items.science--;let lucky=0,breakdowns=0;for(const r of s.roster){const selected=s.lineup.includes(r.id);let gain=between(s,1.25,1.95)*factor*(0.8+r.stats.recovery/380);if(selected&&camp)gain*=2;if(selected&&science)gain*=1.35;if(random(s)<0.055 && r.fatigue<55){gain*=2;lucky++;}gain*=r.fatigue>75?0.62:1;r.stats[focus]=Math.round(clamp(r.stats[focus]+gain,0,99)*10)/10;r.fatigue=clamp(r.fatigue+fatigue+(selected&&camp?5:0)-between(s,1,4)-r.stats.recovery/85,0,100);r.morale=clamp(r.morale+between(s,-3,2),15,100);if(r.fatigue>83&&random(s)<0.15){r.fatigue=clamp(r.fatigue+8,0,100);r.morale=clamp(r.morale-8,0,100);breakdowns++;}}s.week++;if(s.offer && s.week>s.offer.expires)s.offer=null;let newInvite=false;if(s.week<12&&!s.offer&&random(s)<0.055){s.offer={expires:Math.min(11,s.week+2)};newInvite=true;}s.lastLog=`第${s.week}週：${focus}を強化。`+(camp?" 強化合宿の成長2倍が発動。":"")+(science?" 科学測定の成長1.35倍が発動。":"")+(lucky?` ${lucky}名が好調で成長2倍。`:"")+(breakdowns?` ${breakdowns}名が疲労でコンディション悪化。`:"")+(newInvite?" 合同合宿の招待枠が届いた！期限内なら参加費を節約できます。":"");return s}

function paceFor(stats,hillIndex,gritBoost){return 270.5-0.355*stats.speed-0.245*stats.stamina-(hillIndex===1?0.205:hillIndex===3?0.055:0.115)*stats.hill-0.13*(stats.grit+gritBoost)}

function startRace(s){if(s.race)throw Error("すでに大会が始まっています");if(s.week<12)throw Error("12週の練習を終えてください");let contestants=[{name:"あなたの大学",total:0,splits:[],human:true},...RIVALS.map(x=>({...x,total:0,splits:[],runners:LEGS.map((_,i)=>makeRivalRunner(s,x,i))}))];let weather=random(s)<0.25?"雨":"晴";s.race={leg:0,segment:0,weather,contestants,notes:[],rank:null,finished:false};addMoney(s,-480000,"大会遠征費","宿泊・移動・大会参加関連費");s.lastLog=`全国駅伝が開幕。天候は${weather}。5区間、計50kmの戦いです。`;return s}

// All CPU schools receive a fixed athlete per leg; training and form differ across years.
// One uniform random seed governs all athlete draws, strategy choices and race-day noise.
function makeRivalRunner(s,team,leg){
  const grade=1+Math.floor(random(s)*4),form=normal(s)*2.9;
  const strength=team.base+Math.min(2,(s.year-1)*0.3)+form;
  const stats={speed:clamp(strength+between(s,-3,3),40,99),stamina:clamp(strength+between(s,-3,3),40,99),hill:clamp(strength+between(s,-6,6),40,99),grit:clamp(strength+between(s,-3,3),40,99)};
  return {name:"架空選手 "+(leg+1),grade,stats,morale:between(s,67,88),fatigue:between(s,8,31),clutch:between(s,0,1)};
}
function raceStrategy(s,c,segment){
  if(c.human)return "steady";
  const leader=s.race.contestants.reduce((n,x)=>Math.min(n,x.total),Infinity);
  const behind=c.total-leader,roll=random(s);
  if(segment===2 && behind>40 && roll<0.75)return "push";
  if(segment===0 && c.boss && roll<0.55)return "save";
  if(c.energy<35 && roll<0.70)return "save";
  return roll<0.23?"push":roll<0.48?"save":"steady";
}
function stepRace(s,stance="steady"){
  const race=s.race;
  if(!race||race.finished)throw Error("進行中の大会がありません");
  if(!["save","steady","push"].includes(stance))throw Error("作戦が不正です");
  if(!Number.isInteger(race.segment))race.segment=0; // compatibility with v0.1 saves
  const leg=race.leg,segment=race.segment,course=LEGS[leg],distance=course.km/3,rain=race.weather==="雨";
  const athlete=s.roster.find(x=>x.id===s.lineup[leg]);
  if(!athlete)throw Error("出走選手が見つかりません");
  const notes=[];
  for(const c of race.contestants){
    const runner=c.human?{...athlete,clutch:athlete.traits.clutch}:c.runners[leg];
    const {stats,morale,fatigue,grade,clutch}=runner;
    if(segment===0){c.energy=clamp(68+0.30*stats.stamina-0.20*fatigue,55,98);c.legForm=normal(s)*5.2;c.legSeconds=0;c.legBonus=grade===4&&random(s)<0.36?(1.5+3.2*clutch):0;}
    const tacticalStance=c.human?stance:raceStrategy(s,c,segment);
    const staminaBefore=c.energy;
    const spent=tacticalStance==="push"?32:tacticalStance==="save"?13:21;
    const speedBonus=tacticalStance==="push"?-4.4:tacticalStance==="save"?2.6:0;
    const lowEnergy=Math.max(0,39-staminaBefore);
    const energyPenalty=lowEnergy*0.36+(tacticalStance==="push"?Math.max(0,48-staminaBefore)*0.28:0);
    const tiredPenalty=fatigue>48?(fatigue-48)*0.15:0;
    const moralePenalty=(75-morale)*0.09;
    const weatherPenalty=rain?3.0:0;
    const rainKit=c.human&&s.items.rain>0&&rain?0.35:1;
    const senior=c.legBonus*(c.human?1:0.85);
    const randomSegment=normal(s)*2.6;
    const badEvent=random(s)<0.015?between(s,5,12):0;
    const pace=clamp(paceFor(stats,leg,senior)+c.legForm+randomSegment+speedBonus+energyPenalty+tiredPenalty+moralePenalty+weatherPenalty*rainKit+badEvent,176,290);
    const seconds=Math.round(distance*pace);
    if(segment===0)c.splits.push({seconds:0,runner:c.human?athlete.name:runner.name,pace:0,seniorBonus:Math.round(senior*10)/10,dayNoise:Math.round(c.legForm*10)/10,partials:[]});
    const split=c.splits[leg];
    split.partials.push({section:segment+1,seconds,pace:Math.round(pace*10)/10,stance:tacticalStance,energyBefore:Math.round(staminaBefore),energyAfter:Math.round(Math.max(0,staminaBefore-spent))});
    split.seconds+=seconds;split.pace=Math.round(split.seconds/course.km*10)/10;
    c.total+=seconds;c.legSeconds+=seconds;c.energy=Math.max(0,staminaBefore-spent);
    if(c.human){
      if(c.legBonus>0&&segment===0)notes.push(athlete.name+"（4年）の粘りが光る");
      if(c.legForm<-5&&segment===0)notes.push(athlete.name+"が絶好調");
      if(lowEnergy>15)notes.push(athlete.name+"のスタミナが厳しい");
    }else if(badEvent>0)notes.push(c.name+"に失速");
  }
  race.segment++;
  if(leg===0 && segment===0 && rain && s.items.rain>0){s.items.rain--;notes.push("雨天用装備が活躍");}
  race.contestants.sort((a,b)=>a.total-b.total);
  race.rank=race.contestants.findIndex(c=>c.human)+1;
  const checkpoint=""+(leg+1)+"区 "+race.segment+"/3地点";
  race.notes.push({leg:leg+1,segment:race.segment,rank:race.rank,text:(notes.slice(0,2).join("。")||"ペースの駆け引きが続く")+"（"+checkpoint+"）"});
  s.lastLog=checkpoint+"：現在"+race.rank+"位。"+notes.slice(0,2).join("。");
  if(race.segment===3){
    race.segment=0;race.leg++;
    if(race.leg===5){
      race.finished=true;const rank=race.rank;
      let donation=Math.round((9-rank)*25000);
      if(rank<=3)donation+=200000;
      addMoney(s,donation,"収入","卒業生からの大会後支援（"+rank+"位）");
      if(rank===1)s.awards++;
      s.lastLog="大会終了："+rank+"位！"+(rank===1?"全国制覇！北稜大学の連覇を止めた。":"来季も強化して王者に挑もう。");
    }
  }
  return s;
}
function nextLeg(s,stance="steady"){
  if(!s.race||s.race.finished)throw Error("進行中の大会がありません");
  const finishLeg=s.race.leg;
  while(!s.race.finished && s.race.leg===finishLeg)stepRace(s,stance);
  return s;
}

function financials(s,year=s.year){let entries=s.ledger.filter(x=>x.year===year);let income=entries.filter(x=>x.amount>0).reduce((n,x)=>n+x.amount,0),expenses=-entries.filter(x=>x.amount<0).reduce((n,x)=>n+x.amount,0),starting=s.ledger.filter(x=>x.year<year).reduce((n,x)=>n+x.amount,0);return {year,income,expenses,net:income-expenses,opening:starting,ending:starting+income-expenses,entries}}

function closeYear(s){if(!s.race||!s.race.finished)throw Error("大会終了後に年度決算を行えます");let r=s.race,old=s.year;/* 年間固定費は期首に全額支払済み。年度末の二重計上は禁止。 */let f=financials(s,old);s.history.push({year:old,rank:r.rank,winner:r.contestants[0].name,finance:{opening:f.opening,income:f.income,expenses:f.expenses,net:f.net,ending:f.ending}});s.year++;s.week=0;s.race=null;let graduates=s.roster.filter(x=>x.grade===4);s.roster=s.roster.filter(x=>x.grade<4);for(const r of s.roster){r.grade++;r.fatigue=clamp(r.fatigue-32,0,30);r.morale=clamp(r.morale+8,40,96);}let maxId=Math.max(0,...s.roster.map(x=>x.id),...graduates.map(x=>x.id));for(let i=0;i<graduates.length;i++){let newId=maxId+i+1,name=NAMES[(newId+2)%NAMES.length];s.roster.push(makeRunner(s,name,1,newId));}s.lineup=s.roster.slice().sort((a,b)=>((b.stats.speed+b.stats.stamina+b.stats.hill)/3)-((a.stats.speed+a.stats.stamina+a.stats.hill)/3)).slice(0,5).map(r=>r.id);let subsidy=4000000+Math.min(500000,(s.year-1)*75000);addMoney(s,subsidy,"収入","大学からの年間部費配分");addMoney(s,450000+Math.floor(between(s,0,300000)),"収入","OB・OG会の年間活動支援");addMoney(s,-2200000,"固定費","年間運営経費（施設・保険・指導補助・用具）");s.lastLog=`${old}年度の決算を確定。${graduates.length}名が卒業し、${s.year}年目の新入部員が加入しました。`;return s}

globalThis.EkidenEngine={SKILLS,LEGS,SHOP,RIVALS,newGame,validate,setLineup,buyItem,train,startRace,stepRace,nextLeg,financials,closeYear};
