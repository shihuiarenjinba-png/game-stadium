// EKIDEN MANAGER — pure simulation engine. No network or external dependencies.
const MAX_SEASONS=8;
const WATER_COST=12000;
const SKILLS=["speed","stamina","hill","grit","recovery"];
const LEGS=[{"km":8,"title":"1区・平坦"},{"km":10,"title":"2区・登坂"},{"km":12,"title":"3区・持久戦"},{"km":8,"title":"4区・下り"},{"km":12,"title":"5区・最終勝負"}];
const SHOP={"elite":{"name":"全国強化プログラム","cost":780000,"desc":"次の3回の練習で選抜5名の成長×1.6。疲労が増える最上位支援。"},"camp":{"name":"強化合宿","cost":420000,"desc":"次の1回、出走予定5人の対象能力成長を2倍。疲労増加あり"},"science":{"name":"フォーム・乳酸測定","cost":160000,"desc":"次の1回、出走予定5人の対象能力成長を1.35倍"},"recovery":{"name":"栄養・リカバリー支援","cost":150000,"desc":"全部員の疲労を軽減し、士気を改善"},"rain":{"name":"雨天用シューズ・備品","cost":240000,"desc":"次大会1回、雨天時のペース低下を緩和"}};
const RIVALS=[{"name":"北稜大学","base":86.5,"boss":true},{"name":"東央大学","base":80.5},{"name":"西峰大学","base":77.8},{"name":"海風大学","base":74.4},{"name":"栄進大学","base":71.8},{"name":"緑ヶ丘大学","base":68.8},{"name":"南都大学","base":66}];
const NAMES=["佐藤 智也","田中 陸","山本 駿","伊藤 悠","鈴木 健人","高橋 湊","小林 蒼","渡辺 悠人","中村 大地","加藤 陽太","森 蓮","山口 碧","井上 歩","石川 颯","松本 悠真","清水 仁","前田 航"];

function random(s){s.rng=(Math.imul(1664525,s.rng>>>0)+1013904223)>>>0; return s.rng/4294967296}

function between(s,a,b){return a+(b-a)*random(s)}

function normal(s){let a=Math.max(1e-10,random(s)),b=random(s);return Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*b)}

function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n))}

function addMoney(s,amount,kind,label){if(amount<0 && s.cash+amount<0)throw Error("部費残高が不足しています");s.cash+=amount;s.ledger.push({year:s.year,week:s.week,amount,kind,label});}

function makeRunner(s,name,grade,id){let level=54+grade*4+(grade===1?Math.min(14,(s.year-1)*3.3):0)+between(s,-5,9);let x={id,name,grade,fatigue:between(s,6,18),morale:between(s,60,86),traits:{clutch:between(s,0,1),hill:between(s,-5,5),consistency:Math.round(between(s,30,92)),stage:Math.round(between(s,12,96))},stats:{}};for(const k of SKILLS)x.stats[k]=Math.round(clamp(level+between(s,-7,7),35,90)*10)/10;return x}


const HIGH_SCHOOLS=["北浜","青葉","栄明","桜野","海東","西丘","若松","山ノ手","翠嶺","東海","白鷺","光陵","玄海","南翔","北都","成和","旭ヶ丘","中岳","清流","東雲","啓星","潮見","明星","金嶺","富嶽","竹原","松風","陽南","久遠","北原","彩雲","瑞穂","湘明","日高","常盤","優駿","蒼山","南風","鶴見","朝凪"].map((name,i)=>({id:i,name:name+"高等学校",region:["北日本","東日本","中日本","西日本","南日本"][i%5],style:["速度型","登坂型","持久型","総合型"][i%4]}));
const SCOUT_COST=180000;
function highSchoolPool(s){
 const seed=((s.scoutSeed||1)^(Math.imul(s.year,2654435761)))>>>0;let x=seed;
 const rand=()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296};
 const pool=[];
 for(const school of HIGH_SCHOOLS){
   const count=2+Math.floor(rand()*2);
   for(let j=0;j<count;j++){
     const exceptional=rand()<.036;
     const genius=exceptional&&rand()<.23;
     const styleKey=["speed","hill","stamina","grit"][school.id%4];
     const stats={};
     for(const skill of SKILLS){
       let v=54+rand()*17+(skill===styleKey?5:0);
       if(exceptional)v+=(genius?16:skill===styleKey?22:9);
       stats[skill]=Math.round(clamp(v,35,99)*10)/10;
     }
     const surname=NAMES[Math.floor(rand()*NAMES.length)].split(" ")[0];
     const given=NAMES[Math.floor(rand()*NAMES.length)].split(" ")[1];
     pool.push({id:school.id*10+j,schoolId:school.id,name:surname+" "+given,stats,
       talent:genius?"天才1年生":exceptional?"特待級ルーキー":null,
       potential:exceptional?99:Math.round(83+rand()*15)});
   }
 }
 return pool;
}
function ensureScouting(s){
 if(!Number.isInteger(s.scoutSeed))s.scoutSeed=s.rng>>>0;
 if(!Array.isArray(s.scoutedSchools))s.scoutedSchools=[];
 if(!Array.isArray(s.recruitTargets))s.recruitTargets=[];
 if(!Array.isArray(s.prospects)||s.prospects.length<HIGH_SCHOOLS.length*2)s.prospects=highSchoolPool(s);
 return s;
}
function visibleScouting(s){
 ensureScouting(s);
 return HIGH_SCHOOLS.map(school=>({id:school.id,name:school.name,region:school.region,style:school.style,
   scouted:s.scoutedSchools.includes(school.id),
   prospects:s.scoutedSchools.includes(school.id)?s.prospects.filter(p=>p.schoolId===school.id).map(p=>({
     id:p.id,name:p.name,talent:p.talent,potential:p.potential,grade:"高校3年",
     approx:Object.fromEntries(SKILLS.map(k=>[k,Math.round(p.stats[k]/5)*5])),
     targeted:s.recruitTargets.includes(p.id)
   })):[]}));
}
function targetRecruit(s,id){
 ensureScouting(s);
 if(s.race||s.week>=12)throw Error("勧誘予約は大会前のみ設定できます");
 if(!Number.isInteger(id))throw Error("候補者IDが不正です");
 const p=s.prospects.find(p=>p.id===id&&s.scoutedSchools.includes(p.schoolId));
 if(!p)throw Error("未調査の高校生は勧誘できません");
 if(s.recruitTargets.includes(id)){s.recruitTargets=s.recruitTargets.filter(t=>t!==id);s.lastLog=p.name+"の勧誘予約を解除。";return s;}
 if(s.recruitTargets.length>=3)throw Error("勧誘予約は最大3名です");
 s.recruitTargets.push(id);s.lastLog=p.name+"に来年度の入部を打診します。本人の判断で辞退する場合があります。";return s;
}

function newGame(seed=20261008){let s={version:1,year:1,week:0,rng:(seed>>>0)||1,cash:0,roster:[],lineup:[],ledger:[],history:[],alumni:[],events:[],items:{camp:0,science:0,recovery:0,rain:0,elite:0},scouting:0,scoutSeed:(seed>>>0)||1,scoutedSchools:[],recruitTargets:[],prospects:[],offer:null,prediction:null,ending:null,race:null,lastLog:"創部1年目。全国駅伝の絶対王者・北稜大学に挑戦します。",awards:0};for(let i=0;i<10;i++){let grade=i<2?4:i<5?3:i<8?2:1;s.roster.push(makeRunner(s,NAMES[i],grade,i+1));}s.lineup=s.roster.slice(0,5).map(r=>r.id);ensureRivalTeams(s);ensureScouting(s);addMoney(s,4000000,"収入","大学からの年間部費配分");addMoney(s,600000,"収入","OB・OG会の年間活動支援");addMoney(s,-2200000,"固定費","年間運営経費（施設・保険・指導補助・用具）");return s}

function validate(s){
  if(!s||s.version!==1||!Number.isInteger(s.year)||s.year<1||s.year>1000||!Number.isInteger(s.week)||s.week<0||s.week>12||!Number.isInteger(s.rng)||!Number.isSafeInteger(s.cash)||s.cash<0)
    throw Error("セーブデータの基本情報が不正です");
  if(!Array.isArray(s.roster)||s.roster.length<5||s.roster.length>30||!Array.isArray(s.lineup)||s.lineup.length!==5||!Array.isArray(s.ledger)||s.ledger.length>200000||!Array.isArray(s.history)||s.history.length>1000)
    throw Error("セーブデータの選手・台帳形式が不正です");
  const ids=new Set();
  for(const r of s.roster){
    if(!r||!Number.isInteger(r.id)||ids.has(r.id)||typeof r.name!=="string"||r.name.length>100||!Number.isInteger(r.grade)||r.grade<1||r.grade>4||!r.stats||typeof r.stats!=="object")
      throw Error("選手データが不正です");
    ids.add(r.id);
    for(const skill of SKILLS)if(!Number.isFinite(r.stats[skill])||r.stats[skill]<0||r.stats[skill]>100)throw Error("能力値が不正です");
    if(!Number.isFinite(r.fatigue)||r.fatigue<0||r.fatigue>100||!Number.isFinite(r.morale)||r.morale<0||r.morale>100||!Number.isFinite(r.traits?.clutch))throw Error("選手コンディションが不正です");if(["consistency","stage"].some(k=>r.traits[k]!==undefined&&(!Number.isInteger(r.traits[k])||r.traits[k]<0||r.traits[k]>100)))throw Error("心理特性が不正です");
  }
  if(new Set(s.lineup).size!==5||s.lineup.some(id=>!ids.has(id)))throw Error("区間配置が不正です");
  let balance=0;
  for(const row of s.ledger){
    if(!row||!Number.isSafeInteger(row.amount)||!Number.isInteger(row.year)||row.year<1||row.year>s.year||typeof row.kind!=="string"||row.kind.length>100||typeof row.label!=="string"||row.label.length>200)throw Error("部費台帳が不正です");
    balance+=row.amount;
  }
  if(!Number.isSafeInteger(balance)||balance!==s.cash)throw Error("セーブデータの部費残高が台帳と一致しません");
  if(s.ending!==undefined&&s.ending!==null&&!["won","lost"].includes(s.ending))throw Error("ゲーム終了状態が不正です");
  if(s.prediction!==undefined&&s.prediction!==null){
    const p=s.prediction;
    if(!p||typeof p!=="object"||!["placed","won","lost"].includes(p.status)||
       !Number.isInteger(p.year)||p.year<1||p.year>s.year||
       !RIVALS.some(t=>t.name===p.team)&&p.team!=="あなたの大学"||
       !Number.isInteger(p.rank)||p.rank<1||p.rank>8||
       !Number.isSafeInteger(p.stake)||p.stake<20000||p.stake>400000||p.stake%10000!==0||
       !Number.isFinite(p.odds)||p.odds<1||p.odds>16||
       !Number.isSafeInteger(p.payout)||p.payout<0||p.payout>6400000)
       throw Error("順位予想データが不正です");
  }
  if("alumni" in s && (!Array.isArray(s.alumni)||s.alumni.length>10000))throw Error("卒業生データが不正です");
  if("scouting" in s && (!Number.isInteger(s.scouting)||s.scouting<0||s.scouting>3))throw Error("スカウト投資が不正です");
  if(!s.items||!["camp","science","recovery","rain"].every(k=>Number.isInteger(s.items[k])&&s.items[k]>=0&&s.items[k]<=100)||
    ("elite" in s.items&&(!Number.isInteger(s.items.elite)||s.items.elite<0||s.items.elite>3)))throw Error("備品の保有データが不正です");
  if(s.rivalTeams!==undefined&&(!Array.isArray(s.rivalTeams)||s.rivalTeams.length!==7||s.rivalTeams.some(t=>
    !t||!Array.isArray(t.roster)||t.roster.length!==10||!Number.isSafeInteger(t.cash)||t.cash<0||
    !t.finance||!Number.isSafeInteger(t.finance.income)||!Number.isSafeInteger(t.finance.expenses)||
    (Number.isSafeInteger(t.finance.opening)&&t.finance.opening+t.finance.income-t.finance.expenses!==t.cash)||
    t.roster.some(r=>!r||!Number.isInteger(r.id)||!r.name||!Number.isInteger(r.grade)||r.grade<1||r.grade>4||!r.stats||SKILLS.some(k=>!Number.isFinite(r.stats[k])||r.stats[k]<0||r.stats[k]>100))||
    !Array.isArray(t.lineup)||t.lineup.length!==5||new Set(t.lineup).size!==5||t.lineup.some(id=>!t.roster.some(r=>r.id===id))
  )))throw Error("CPU大学の保存データが不正です");
  if(s.scoutedSchools!==undefined&&(!Array.isArray(s.scoutedSchools)||s.scoutedSchools.length>3||new Set(s.scoutedSchools).size!==s.scoutedSchools.length||s.scoutedSchools.some(id=>!Number.isInteger(id)||!HIGH_SCHOOLS[id])))throw Error("スカウト高校の情報が不正です");
  if(s.recruitTargets!==undefined&&(!Array.isArray(s.recruitTargets)||s.recruitTargets.length>3||new Set(s.recruitTargets).size!==s.recruitTargets.length||s.recruitTargets.some(id=>!Number.isInteger(id))))throw Error("勧誘候補の情報が不正です");
  if(s.prospects!==undefined&&(!Array.isArray(s.prospects)||s.prospects.length>150||s.prospects.some(p=>!p||!Number.isInteger(p.id)||!Number.isInteger(p.schoolId)||!HIGH_SCHOOLS[p.schoolId]||typeof p.name!=="string"||p.name.length>100||!p.stats||SKILLS.some(k=>!Number.isFinite(p.stats[k])||p.stats[k]<0||p.stats[k]>99))))throw Error("候補者情報が不正です");
  if(Array.isArray(s.recruitTargets)&&Array.isArray(s.prospects)&&s.recruitTargets.some(id=>!s.prospects.some(p=>p.id===id&&s.scoutedSchools.includes(p.schoolId))))throw Error("未視察選手を勧誘しています");
  if(s.events!==undefined&&(!Array.isArray(s.events)||s.events.length>MAX_SEASONS*12*2||s.events.some(e=>!e||!Number.isInteger(e.year)||!Number.isInteger(e.week)||typeof e.headline!=="string"||e.headline.length>120||typeof e.detail!=="string"||e.detail.length>300)))throw Error("イベント履歴が不正です");
  if(s.roster.some(r=>("focusLoss" in r&&(!Number.isInteger(r.focusLoss)||r.focusLoss<0||r.focusLoss>4))||("focusBoost" in r&&(!Number.isInteger(r.focusBoost)||r.focusBoost<0||r.focusBoost>4))))throw Error("選手のイベント効果が不正です");
  if(s.race&&("waterSpent" in s.race&&(!Number.isSafeInteger(s.race.waterSpent)||s.race.waterSpent<0||s.race.waterSpent>MAX_SEASONS*15*3*WATER_COST)))throw Error("給水費用が不正です");
  if(s.race && (!Array.isArray(s.race.contestants)||s.race.contestants.length!==8||!Number.isInteger(s.race.leg)||s.race.leg<0||s.race.leg>5||s.race.finished!==true&&s.race.leg===5))throw Error("大会データが不正です");
  return true;
}
function migrateSave(s){
  validate(s);
  if(!Number.isInteger(s.scouting))s.scouting=0;
  if(s.prediction===undefined)s.prediction=null;
  if(s.ending===undefined)s.ending=null;
  if(!Array.isArray(s.alumni))s.alumni=[];
  if(!Array.isArray(s.events))s.events=[];
  for(const r of s.roster){if(!Number.isInteger(r.focusLoss))r.focusLoss=0;if(!Number.isInteger(r.focusBoost))r.focusBoost=0;if(!Number.isInteger(r.traits.consistency))r.traits.consistency=60;if(!Number.isInteger(r.traits.stage))r.traits.stage=55;}
  if(s.items&&s.items.elite===undefined)s.items.elite=0;
  ensureScouting(s);
  ensureRivalTeams(s);
  for(const team of s.rivalTeams)for(const r of team.roster){if(!Number.isInteger(r.consistency))r.consistency=60;if(!Number.isInteger(r.stage))r.stage=55;}
  for(const team of s.rivalTeams)if(!Number.isSafeInteger(team.finance.opening))team.finance.opening=team.cash-team.finance.income+team.finance.expenses;
  if(s.race){
    if(!Number.isInteger(s.race.segment))s.race.segment=0;
    if(!s.race.finished)for(const c of s.race.contestants)if(!c.human&&!Array.isArray(c.runners)){
      const known=RIVALS.find(x=>x.name===c.name);
      if(!known)throw Error("旧版セーブデータの対戦相手を復元できません");
      const team=s.rivalTeams.find(t=>t.name===known.name);c.runners=team.lineup.map(id=>{const r=team.roster.find(x=>x.id===id);return {id:r.id,name:r.name,grade:r.grade,stats:{...r.stats},morale:r.morale,fatigue:r.fatigue,clutch:r.clutch,consistency:r.consistency??60,stage:r.stage??55};});
    }
    if(typeof s.race.rainProtection!=="boolean")s.race.rainProtection=false;
  }
  return s;
}

function setLineup(s,ids){if(s.prediction&&s.prediction.status==="placed")throw Error("順位予想の購入後は区間配置を変更できません");if(s.race)throw Error("大会開催中は区間配置を変更できません");if(!Array.isArray(ids)||ids.length!==5||new Set(ids.map(Number)).size!==5||ids.some(id=>!s.roster.some(r=>r.id===Number(id))))throw Error("異なる選手を5名選んでください");s.lineup=ids.map(Number);return s}

function buyItem(s,key){if(s.race||s.week>=12)throw Error("大会前の練習期間のみ購入できます");let special=key==="invite";let item=special&&s.offer&&s.week<=s.offer.expires?{name:"特別合同合宿への招待枠",cost:260000}:SHOP[key];if(!item)throw Error("その備品はありません");let stockKey=special?"camp":key;if(key==="elite"&&s.items.elite>0)throw Error("全国強化プログラムは使い切ってから再購入してください");if(key!=="recovery" && key!=="elite" && s.items[stockKey]>=2)throw Error("同一アイテムの保管上限は2個です");if(s.cash-item.cost<480000+(12-s.week)*38000)throw Error("残りの最低練習費と大会遠征費を確保してください");addMoney(s,-item.cost,"購入費",item.name);if(key==="recovery"){for(const r of s.roster){r.fatigue=clamp(r.fatigue-23,0,100);r.morale=clamp(r.morale+6,0,100);}s.lastLog="栄養・回復支援により疲労を軽減しました。";}else{s.items[stockKey]+=key==="elite"?3:1;if(special)s.offer=null;s.lastLog=item.name+"を購入しました（次回の対象機会に使用）。";}return s}

function investScouting(s,schoolId=null){
  if(s.race||s.week>=12)throw Error("スカウト活動は練習期間中に行います");
  ensureScouting(s);
  if(s.scouting>=3)throw Error("高校訪問は年度ごとに最大3回です");
  if(schoolId===null||schoolId===undefined)schoolId=HIGH_SCHOOLS.find(x=>!s.scoutedSchools.includes(x.id))?.id;
  if(!Number.isInteger(schoolId)||!HIGH_SCHOOLS[schoolId])throw Error("高校の指定が不正です");
  if(s.scoutedSchools.includes(schoolId))throw Error("この高校は既に調査済みです");
  if(s.cash-SCOUT_COST<480000+(12-s.week)*38000)throw Error("残りの最低練習費と大会遠征費を確保してください");
  const school=HIGH_SCHOOLS[schoolId];
  addMoney(s,-SCOUT_COST,"採用・勧誘費",school.name+"の視察・交通・調査費");
  s.scouting++;
  s.scoutedSchools.push(schoolId);
  const students=s.prospects.filter(p=>p.schoolId===schoolId),standouts=students.filter(p=>p.talent);
  s.lastLog=school.name+"を視察し、"+students.length+"人の候補者を確認。"+(standouts.length?"★逸材の報告あり！":"勧誘する高校生を選べます。");
  return s;
}

function weeklySurprise(s){
  if(random(s)>=.24)return null;
  const sorted=[...s.roster].sort((a,b)=>SKILLS.reduce((v,k)=>v+b.stats[k]-a.stats[k],0));
  const talented=sorted[0],target=s.roster[Math.floor(random(s)*s.roster.length)];
  const event=Math.floor(random(s)*9);
  let headline="",detail="",runner=target;
  switch(event){
    case 0:runner=talented;runner.focusLoss=Math.max(runner.focusLoss||0,2);runner.morale=clamp(runner.morale+4,15,100);headline="恋人ができた主力選手";detail=runner.name+"は恋人との予定が重なり、今後2週は練習時間が減る。一方、私生活は充実して士気が少し上がった。";break;
    case 1:runner=talented;runner.focusBoost=Math.max(runner.focusBoost||0,2);runner.morale=clamp(runner.morale+9,15,100);headline="恋人の応援が力に";detail=runner.name+"は応援を励みに、次の2週で集中力が高まる。";break;
    case 2:runner=target;runner.fatigue=clamp(runner.fatigue+19,0,100);headline="軽い足の痛み";detail=runner.name+"が疲労を訴えた。練習負荷を下げれば回復が早い。";break;
    case 3:runner=target;runner.stats.hill=clamp(Math.round((runner.stats.hill+2.8)*10)/10,0,99);headline="坂道トレーニング開眼";detail=runner.name+"が上りのフォームを改善。登坂能力が上昇。";break;
    case 4:runner=target;runner.stats.speed=clamp(Math.round((runner.stats.speed+2.2)*10)/10,0,99);headline="ライバルとの特別練習";detail=runner.name+"が合同練習で刺激を受け、速度能力が上昇。";break;
    case 5:runner=target;runner.morale=clamp(runner.morale-15,15,100);headline="SNSの批判で不調";detail=runner.name+"が外部の声を気にし、士気が落ちた。";break;
    case 6:for(const r of s.roster){r.fatigue=clamp(r.fatigue-11,0,100);}headline="栄養士の食事改革";detail="全部員の疲労が軽減。部費追加支出なしで効果を得られた。";break;
    case 7:runner=target;runner.focusBoost=Math.max(runner.focusBoost||0,2);headline="卒業生の走法指導";detail=runner.name+"がOBの助言を受け、次の2週の育成効率が上昇。";break;
    default:addMoney(s,135000,"臨時支援","地域の応援団から活動寄付");headline="地域の応援団が支援";detail="駅伝部への活動寄付13万5千円。大会中の給水費用にも回せる。";
  }
  const record={year:s.year,week:s.week,type:event,headline,detail,runnerId:runner?.id||null};
  if(!Array.isArray(s.events))s.events=[];
  s.events.push(record);
  return record;
}
function train(s,focus="stamina",intensity="normal"){if(s.race)throw Error("大会開催中です");if(s.week>=12)throw Error("練習期間が終了しました。大会へ進んでください");if(!SKILLS.includes(focus))throw Error("能力値が不正です");if(!["light","normal","hard"].includes(intensity))throw Error("練習強度が不正です");let cost={light:38000,normal:72000,hard:110000}[intensity], factor={light:0.65,normal:1,hard:1.35}[intensity],fatigue={light:2,normal:6,hard:12}[intensity];if(s.cash-cost<480000+(11-s.week)*38000)throw Error("残りの最低練習費と大会遠征費を確保してください");addMoney(s,-cost,"練習費",["調整練習","通常練習","高強度練習"][["light","normal","hard"].indexOf(intensity)]);let camp=s.items.camp>0,science=s.items.science>0,elite=(s.items.elite||0)>0;if(camp)s.items.camp--;if(science)s.items.science--;if(elite)s.items.elite--;let lucky=0,breakdowns=0;for(const r of s.roster){const selected=s.lineup.includes(r.id);let gain=between(s,1.25,1.95)*factor*(0.8+r.stats.recovery/380);if(selected&&camp)gain*=2;if(selected&&science)gain*=1.35;if(selected&&elite)gain*=1.6;if(r.focusLoss>0)gain*=0.53;if(r.focusBoost>0)gain*=1.35;if(random(s)<0.055 && r.fatigue<55){gain*=2;lucky++;}gain*=r.fatigue>75?0.62:1;r.stats[focus]=Math.round(clamp(r.stats[focus]+gain,0,99)*10)/10;r.fatigue=clamp(r.fatigue+fatigue+(selected&&camp?5:0)+(selected&&elite?4:0)-between(s,1,4)-r.stats.recovery/85,0,100);r.morale=clamp(r.morale+between(s,-3,2),15,100);if(r.fatigue>83&&random(s)<0.15){r.fatigue=clamp(r.fatigue+8,0,100);r.morale=clamp(r.morale-8,0,100);breakdowns++;}if(r.focusLoss>0)r.focusLoss--;if(r.focusBoost>0)r.focusBoost--;}rivalTraining(s);s.week++;if(s.offer && s.week>s.offer.expires)s.offer=null;let newInvite=false;if(s.week<12&&!s.offer&&random(s)<0.055){s.offer={expires:Math.min(11,s.week+2)};newInvite=true;}s.lastLog=`第${s.week}週：${focus}を強化。`+(camp?" 強化合宿の成長2倍が発動。":"")+(science?" 科学測定の成長1.35倍が発動。":"")+(elite?" 全国強化プログラムの成長1.6倍が発動（残り"+s.items.elite+"回）。":"")+(lucky?` ${lucky}名が好調で成長2倍。`:"")+(breakdowns?` ${breakdowns}名が疲労でコンディション悪化。`:"")+(newInvite?" 合同合宿の招待枠が届いた！期限内なら参加費を節約できます。":"");const surprise=weeklySurprise(s);if(surprise)s.lastLog+=" 【イベント】"+surprise.headline+"："+surprise.detail;return s}

// These coefficients are fictional game balancing, not sports medicine.
function pressureOutcome(s,runner){
 const grit=runner.stats.grit,stage=clamp(runner.stage??55,0,100),stable=clamp(runner.consistency??60,0,100);
 const chokeChance=clamp(.025+(100-stage)*.0017+(100-runner.morale)*.00045-(grit-50)*.00023,.012,.23);
 const flowChance=clamp(.045+stage*.00065+(runner.morale-65)*.0004,.04,.13);
 const roll=random(s),state=roll<chokeChance?"choke":roll<chokeChance+flowChance?"flow":"steady";
 const swing=state==="choke"?between(s,7,14):state==="flow"?-between(s,4,9):0;
 const noise=normal(s)*(1.4+(100-stable)*.055);
 return {state,pacePenalty:Math.round((swing+noise)*10)/10,chokeChance:Math.round(chokeChance*1000)/10,flowChance:Math.round(flowChance*1000)/10};
}
function paceFor(stats,hillIndex,gritBoost){return 270.5-0.355*stats.speed-0.245*stats.stamina-(hillIndex===1?0.205:hillIndex===3?0.055:0.115)*stats.hill-0.13*(stats.grit+gritBoost)}

function startRace(s){if(s.race)throw Error("すでに大会が始まっています");if(s.week<12)throw Error("12週の練習を終えてください");const schools=ensureRivalTeams(s);for(const team of schools)team.lineup=selectRivalLineup(team);
let contestants=[{name:"あなたの大学",total:0,splits:[],human:true},...schools.map(t=>({
name:t.name,boss:t.boss,base:t.base,total:0,splits:[],runners:t.lineup.map(id=>{const r=t.roster.find(x=>x.id===id);return {id:r.id,name:r.name,grade:r.grade,stats:{...r.stats},morale:r.morale,fatigue:r.fatigue,clutch:r.clutch};})
}))];let weather=random(s)<0.25?"雨":"晴";s.race={leg:0,segment:0,weather,contestants,notes:[],rank:null,finished:false,waterSpent:0,waterCups:0,rainProtection:weather==="雨"&&s.items.rain>0};if(s.race.rainProtection)s.items.rain--;addMoney(s,-480000,"大会遠征費","宿泊・移動・大会参加関連費");s.lastLog=`全国駅伝が開幕。天候は${weather}。5区間、計50kmの戦いです。`;return s}

// All CPU schools receive a fixed athlete per leg; training and form differ across years.
// One uniform random seed governs all athlete draws, strategy choices and race-day noise.

const CPU_SURNAMES=["神谷","桐生","宮城","坂本","小田","真栄田","藤田","城間","新垣","宮里","西田","川上","村上","比嘉","金城","藤井","岡本","平良"];
const CPU_GIVEN=["隼人","匠","悠斗","蓮","大翔","陸斗","航","凛太郎","葵","樹","蒼","拓海"];
function makeRivalAthlete(s,team,grade,id){
  const level=team.base-7+(grade-1)*0.65+Math.min(2,(s.year-1)*0.3)+normal(s)*2;
  const stats={};
  for(const key of SKILLS)stats[key]=Math.round(clamp(level+between(s,-3.6,3.6),35,99)*10)/10;
  if(team.style==="hill")stats.hill=Math.min(99,stats.hill+2);
  if(team.style==="speed")stats.speed=Math.min(99,stats.speed+2);
  if(team.style==="endurance")stats.stamina=Math.min(99,stats.stamina+2);
  const exceptional=grade===1 && s.year>1 && random(s)<0.035;
  if(exceptional){
    const focus=SKILLS[Math.floor(random(s)*SKILLS.length)];
    for(const key of SKILLS)stats[key]=Math.round(clamp(stats[key]+(focus===key?between(s,17,24):between(s,5,11)),35,99)*10)/10;
  }
  return {id,name:CPU_SURNAMES[(id*7+team.index*3)%CPU_SURNAMES.length]+" "+CPU_GIVEN[(id+team.index*5)%CPU_GIVEN.length],grade,stats,clutch:between(s,0,1),consistency:Math.round(between(s,32,92)),stage:Math.round(between(s,15,95)),morale:between(s,68,90),fatigue:between(s,5,25),talent:exceptional?"特待級ルーキー":null};
}
function selectRivalLineup(team){
  const remaining=[...team.roster],chosen=[];
  for(let leg=0;leg<5;leg++){
    remaining.sort((a,b)=>(paceFor(a.stats,leg,0)+(100-a.morale)*0.018)-(paceFor(b.stats,leg,0)+(100-b.morale)*0.018));
    const athlete=remaining.shift();if(!athlete)throw Error("CPU大学の選手不足");
    chosen.push(athlete.id);
  }
  return chosen;
}
function newRivalTeam(s,template,index){
  const team={index,name:template.name,base:template.base,boss:!!template.boss,style:index===0?"endurance":(["speed","hill","endurance","balanced"][index%4]),cash:2400000,finance:{opening:0,income:4600000,expenses:2200000},roster:[],lineup:[],nextId:11,lastRank:null};
  for(let i=1;i<=10;i++)team.roster.push(makeRivalAthlete(s,team,i<=2?4:i<=5?3:i<=8?2:1,i));
  team.lineup=selectRivalLineup(team);
  return team;
}
function ensureRivalTeams(s){
  if(!Array.isArray(s.rivalTeams))s.rivalTeams=RIVALS.map((template,i)=>newRivalTeam(s,template,i));
  return s.rivalTeams;
}
function rivalTraining(s){
  if(!Array.isArray(s.rivalTeams))return;
  for(const team of s.rivalTeams){
    const weekly=team.cash>=68000?68000:0;
    if(weekly){team.cash-=weekly;team.finance.expenses+=weekly;}
    const focus=team.style==="speed"?["speed","stamina","grit","recovery"][s.week%4]:
      team.style==="hill"?["hill","stamina","grit","speed"][s.week%4]:
      team.style==="endurance"?["stamina","grit","speed","recovery"][s.week%4]:
      SKILLS[s.week%SKILLS.length];
    for(const athlete of team.roster){
      athlete.stats[focus]=Math.round(clamp(athlete.stats[focus]+(weekly?between(s,.38,.65):.12),0,99)*10)/10;
      athlete.fatigue=clamp(athlete.fatigue+(weekly?1.1:.4)-athlete.stats.recovery/120,0,100);
    }
  }
}
function nextRivalYear(s,ranks){
  ensureRivalTeams(s);
  for(const team of s.rivalTeams){
    team.lastRank=ranks[team.name]||8;
    const previous=team.roster;
    team.roster=previous.filter(r=>r.grade<4);
    for(const r of team.roster){
      r.grade++;r.fatigue=clamp(r.fatigue-14,0,30);
      r.morale=clamp(r.morale+between(s,-2,5),55,96);
      for(const key of SKILLS)r.stats[key]=Math.round(clamp(r.stats[key]+between(s,.35,.85),0,99)*10)/10;
    }
    const graduates=previous.length-team.roster.length;
    for(let i=0;i<graduates;i++)team.roster.push(makeRivalAthlete(s,team,1,team.nextId++));
    team.lineup=selectRivalLineup(team);
    const income=4400000+Math.round(between(s,0,400000))+(team.boss?250000:0);
    const fixed=2200000,opening=team.cash;team.cash+=income-fixed;
    team.finance={opening,income,expenses:fixed};
  }
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
function stepRace(s,stance="steady",water=0){
  const race=s.race;
  if(!race||race.finished)throw Error("進行中の大会がありません");
  if(!["save","steady","push"].includes(stance))throw Error("作戦が不正です");
  if(!Number.isInteger(water)||water<0||water>3)throw Error("給水は0〜3杯を指定してください");
  if(s.cash<water*WATER_COST)throw Error("給水予算が不足しています。0杯なら無料で進められます");
  if(!Number.isInteger(race.segment))race.segment=0; // compatibility with v0.1 saves
  const leg=race.leg,segment=race.segment,course=LEGS[leg],distance=course.km/3,rain=race.weather==="雨";
  const athlete=s.roster.find(x=>x.id===s.lineup[leg]);
  if(!athlete)throw Error("出走選手が見つかりません");
  if(water>0){addMoney(s,-water*WATER_COST,"大会給水費","第"+(leg+1)+"区・"+(segment+1)+"地点：給水"+water+"杯");race.waterSpent=(race.waterSpent||0)+water*WATER_COST;race.waterCups=(race.waterCups||0)+water;}
  const notes=[];
  for(const c of race.contestants){
    const runner=c.human?{...athlete,clutch:athlete.traits.clutch,consistency:athlete.traits.consistency,stage:athlete.traits.stage}:c.runners[leg];
    const {stats,morale,fatigue,grade,clutch}=runner;
    if(segment===0){c.energy=clamp(68+0.30*stats.stamina-0.20*fatigue,55,98);c.legForm=normal(s)*5.2;c.legSeconds=0;c.legBonus=grade===4&&random(s)<0.36?(1.5+3.2*clutch):0;c.hydration=62;c.stomach=0;const m=pressureOutcome(s,runner);c.mentalOutcome=m.state;c.mentalPace=m.pacePenalty;c.chokeChance=m.chokeChance;c.flowChance=m.flowChance;}
    const tacticalStance=c.human?stance:raceStrategy(s,c,segment);
    const staminaBefore=c.energy;
    const spent=tacticalStance==="push"?32:tacticalStance==="save"?13:21;
    const speedBonus=tacticalStance==="push"?-4.4:tacticalStance==="save"?2.6:0;
    const lowEnergy=Math.max(0,39-staminaBefore);
    const energyPenalty=lowEnergy*0.36+(tacticalStance==="push"?Math.max(0,48-staminaBefore)*0.28:0);
    const tiredPenalty=fatigue>48?(fatigue-48)*0.15:0;
    const moralePenalty=(75-morale)*(0.12+(100-(runner.consistency??60))*.0007);
    const weatherPenalty=rain?3.0:0;
    const rainKit=c.human&&race.rainProtection&&rain?0.35:1;
    const senior=c.legBonus*(c.human?1:0.85);
    // Each cup is a paid pit-stop support package. One cup usually restores hydration;
    // repeated two/three-cup choices cause simulated stomach sloshing and slower pace.
    const cups=c.human?water:(random(s)<0.35?1:0);
    c.hydration=clamp((c.hydration??62)+cups*24,0,100);
    c.stomach=clamp((c.stomach??0)*0.54+cups*31,0,120);
    const dehydrationPenalty=Math.max(0,36-c.hydration)*0.22;
    const stomachPenalty=Math.max(0,c.stomach-65)*0.45+(cups===3?6:0);
    const waterPenalty=dehydrationPenalty+stomachPenalty;
    const randomSegment=normal(s)*2.6;
    const badEvent=random(s)<0.015?between(s,5,12):0;
    const pace=clamp(paceFor(stats,leg,senior)+c.legForm+randomSegment+speedBonus+energyPenalty+tiredPenalty+moralePenalty+weatherPenalty*rainKit+badEvent+waterPenalty+(c.mentalPace||0),176,290);
    const seconds=Math.round(distance*pace);
    if(segment===0)c.splits.push({seconds:0,runner:c.human?athlete.name:runner.name,pace:0,seniorBonus:Math.round(senior*10)/10,dayNoise:Math.round(c.legForm*10)/10,partials:[]});
    const split=c.splits[leg];
    split.partials.push({section:segment+1,seconds,pace:Math.round(pace*10)/10,stance:tacticalStance,mentalOutcome:c.mentalOutcome||"steady",mentalPenalty:c.mentalPace||0,waterCups:cups,hydration:Math.round(c.hydration),stomach:Math.round(c.stomach),waterPenalty:Math.round(waterPenalty*10)/10,energyBefore:Math.round(staminaBefore),energyAfter:Math.round(Math.max(0,staminaBefore-spent))});
    split.seconds+=seconds;split.pace=Math.round(split.seconds/course.km*10)/10;
    c.total+=seconds;c.legSeconds+=seconds;c.energy=Math.max(0,staminaBefore-spent);c.hydration=Math.max(0,c.hydration-(rain?18:23));
    if(c.human){
      if(c.legBonus>0&&segment===0)notes.push(athlete.name+"（4年）の粘りが光る");if(segment===0&&c.mentalOutcome==="choke")notes.push(athlete.name+"が大舞台の緊張で本来のペースを失う");if(segment===0&&c.mentalOutcome==="flow")notes.push(athlete.name+"が大舞台で集中力を発揮");
      if(c.legForm<-5&&segment===0)notes.push(athlete.name+"が絶好調");
      if(lowEnergy>15)notes.push(athlete.name+"のスタミナが厳しい");if(dehydrationPenalty>3)notes.push(athlete.name+"が水分不足で失速");if(stomachPenalty>3)notes.push(athlete.name+"がお腹タポタポで失速");if(water===1&&dehydrationPenalty<1&&stomachPenalty<1)notes.push("的確な給水で快走");
    }else if(badEvent>0)notes.push(c.name+"に失速");
  }
  race.segment++;
  if(leg===0 && segment===0 && race.rainProtection)notes.push("雨天用装備が活躍");
  race.contestants.sort((a,b)=>a.total-b.total);
  race.rank=race.contestants.findIndex(c=>c.human)+1;
  const checkpoint=""+(leg+1)+"区 "+race.segment+"/3地点";
  race.notes.push({leg:leg+1,segment:race.segment,rank:race.rank,text:(notes.slice(0,2).join("。")||"ペースの駆け引きが続く")+"（"+checkpoint+"）"});
  s.lastLog=checkpoint+"：現在"+race.rank+"位。"+notes.slice(0,2).join("。");
  if(race.segment===3){
    const performance=race.contestants.find(c=>c.human)?.splits[leg];
    if(performance && athlete){
      if(!athlete.records||typeof athlete.records!=="object")athlete.records={};
      const distanceKey=String(course.km);
      athlete.records[distanceKey]=Math.min(athlete.records[distanceKey]??Number.POSITIVE_INFINITY,performance.seconds);
    }
    race.segment=0;race.leg++;
    if(race.leg===5){
      race.finished=true;const rank=race.rank;
      let donation=Math.round((9-rank)*25000);
      if(rank<=3)donation+=200000;
      addMoney(s,donation,"収入","卒業生からの大会後支援（"+rank+"位）");
      if(globalThis.EkidenPrediction)globalThis.EkidenPrediction.settle(s);
      if(rank===1)s.awards++;
      if(s.year>=MAX_SEASONS)s.ending=s.awards>0?"won":"lost";
      s.lastLog="大会終了："+rank+"位！"+(rank===1?"全国優勝！目標達成。":s.ending==="lost"?"8年の期限で全国制覇ならず。ゲームオーバー。":"来季も強化して王者に挑もう。");
    }
  }
  return s;
}
function nextLeg(s,stance="steady",water=0){
  if(!s.race||s.race.finished)throw Error("進行中の大会がありません");
  if(!Number.isInteger(water)||water<0||water>3)throw Error("給水は0〜3杯を指定してください");
  if(s.cash<(3-(s.race.segment||0))*water*WATER_COST)throw Error("区間をまとめるための給水費用が不足しています。給水量を下げてください");
  const finishLeg=s.race.leg;
  while(!s.race.finished && s.race.leg===finishLeg)stepRace(s,stance,water);
  return s;
}

function financials(s,year=s.year){let entries=s.ledger.filter(x=>x.year===year);let income=entries.filter(x=>x.amount>0).reduce((n,x)=>n+x.amount,0),expenses=-entries.filter(x=>x.amount<0).reduce((n,x)=>n+x.amount,0),starting=s.ledger.filter(x=>x.year<year).reduce((n,x)=>n+x.amount,0);return {year,income,expenses,net:income-expenses,opening:starting,ending:starting+income-expenses,entries}}

function closeYear(s){if(s.ending||s.year>=MAX_SEASONS)throw Error("最終年度を終了しました");if(!s.race||!s.race.finished)throw Error("大会終了後に年度決算を行えます");let r=s.race,old=s.year;const scoutInvestment=s.scouting||0;ensureScouting(s);const availableProspects=s.recruitTargets.map(id=>s.prospects.find(p=>p.id===id)).filter(Boolean);const arrivals=[];/* 年間固定費は期首に全額支払済み。年度末の二重計上は禁止。 */let f=financials(s,old);s.history.push({year:old,rank:r.rank,winner:r.contestants[0].name,prediction:s.prediction?{...s.prediction}:null,standings:r.contestants.map((c,i)=>({rank:i+1,name:c.name,seconds:c.total,runners:c.splits.map(x=>({name:x.runner,seconds:x.seconds}))})),finance:{opening:f.opening,income:f.income,expenses:f.expenses,net:f.net,ending:f.ending}});const rivalRanks=Object.fromEntries(r.contestants.map((c,i)=>[c.name,i+1]));s.year++;s.week=0;s.race=null;nextRivalYear(s,rivalRanks);let graduates=s.roster.filter(x=>x.grade===4);if(!Array.isArray(s.alumni))s.alumni=[];for(const runner of graduates)s.alumni.push({id:runner.id,name:runner.name,graduationYear:old,records:{...(runner.records||{})}});s.roster=s.roster.filter(x=>x.grade<4);for(const r of s.roster){r.grade++;r.fatigue=clamp(r.fatigue-32,0,30);r.morale=clamp(r.morale+8,40,96);}let maxId=Math.max(0,...s.roster.map(x=>x.id),...graduates.map(x=>x.id));for(let i=0;i<graduates.length;i++){let newId=maxId+i+1,name=NAMES[(newId+2)%NAMES.length]+" #"+newId;const rookie=makeRunner(s,name,1,newId);
  // A targeted high-school graduate is more likely to accept with a good recruiting reputation.
  const applicant=availableProspects.shift();
  if(applicant&&random(s)<.72+.06*Math.min(3,s.scouting)){
    rookie.name=applicant.name;
    rookie.highSchool=HIGH_SCHOOLS[applicant.schoolId].name;
    rookie.stats={...applicant.stats};
    rookie.talent=applicant.talent;
    rookie.potential=applicant.potential;
    arrivals.push(rookie.name+"（"+rookie.highSchool+"）");
    s.roster.push(rookie);
    continue;
  }
  // A rare outstanding incoming first-year runner; improved discovery odds through scouting.
  const exceptional= random(s)<0.025+scoutInvestment*0.012;
  const prodigy= exceptional&&random(s)<0.22;
  const standout=SKILLS[Math.floor(random(s)*SKILLS.length)];
  for(const k of SKILLS){
    const baseline=rookie.stats[k]+scoutInvestment*2.2;
    const bonus=exceptional?(prodigy?between(s,15,25):k===standout?between(s,19,26):between(s,5,12)):0;
    rookie.stats[k]=Math.round(clamp(baseline+bonus,35,99)*10)/10;
  }
  rookie.talent=prodigy?"天才1年生":exceptional?"特待級ルーキー":null;
  rookie.potential=prodigy?99:exceptional?between(s,95,99):between(s,88,98);
  if(exceptional)rookie.morale=clamp(rookie.morale+between(s,3,8),0,100);
  s.roster.push(rookie);}s.scouting=0;s.scoutedSchools=[];s.recruitTargets=[];s.prospects=[];ensureScouting(s);s.offer=null;s.prediction=null;s.lineup=s.roster.slice().sort((a,b)=>((b.stats.speed+b.stats.stamina+b.stats.hill)/3)-((a.stats.speed+a.stats.stamina+a.stats.hill)/3)).slice(0,5).map(r=>r.id);let subsidy=4000000+Math.min(500000,(s.year-1)*75000);addMoney(s,subsidy,"収入","大学からの年間部費配分");addMoney(s,450000+Math.floor(between(s,0,300000)),"収入","OB・OG会の年間活動支援");addMoney(s,-2200000,"固定費","年間運営経費（施設・保険・指導補助・用具）");const starNewcomers=s.roster.filter(x=>x.grade===1&&x.talent);s.lastLog=`${old}年度決算。${graduates.length}名卒業、新入部員が加入。`+(arrivals.length?" 視察から入部："+arrivals.join("、")+"。":"")+(starNewcomers.length?` 注目の逸材：${starNewcomers.map(x=>x.name+'（'+x.talent+'）').join('、')}！`:``);return s}

globalThis.EkidenEngine={pressureOutcome,MAX_SEASONS,WATER_COST,SCOUT_COST,HIGH_SCHOOLS,ensureScouting,visibleScouting,targetRecruit,SKILLS,LEGS,SHOP,RIVALS,newGame,validate,migrateSave,ensureRivalTeams,selectRivalLineup,setLineup,buyItem,investScouting,train,startRace,stepRace,nextLeg,financials,closeYear};
