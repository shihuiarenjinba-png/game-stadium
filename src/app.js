/* EKIDEN MANAGER — zero-server, no dependencies. */
"use strict";
(() => {
  const E=globalThis.EkidenEngine, KEY="ekiden-manager-v1";
  if(!E){document.getElementById("app").textContent="ゲームの読み込みに失敗しました。";return;}
  const yen=n=>"¥"+Math.round(n).toLocaleString("ja-JP");
  const dec=n=>Number(n).toFixed(1);
  const time=t=>{const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=Math.round(t%60);return (h?h+":"+String(m).padStart(2,"0"):String(m))+":"+String(s).padStart(2,"0")};
  const skillLabels={speed:"スピード",stamina:"スタミナ",hill:"登坂",grit:"精神力",recovery:"回復力"};
  const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const average=r=>Math.round((r.stats.speed+r.stats.stamina+r.stats.hill+r.stats.grit)/4);
  const seed=()=>{const n=new Uint32Array(1);if(globalThis.crypto?.getRandomValues){globalThis.crypto.getRandomValues(n);return n[0]||1;}return (Date.now()>>>0)||1;};
  let state=load(), flash="";
  function load(){try{const raw=localStorage.getItem(KEY);if(raw){const s=E.migrateSave(JSON.parse(raw));return s;}}catch(e){console.warn("セーブデータの読み込みに失敗:",e.message)}return E.newGame(seed())}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){flash="自動保存できませんでした。下の「セーブ書き出し」を使用してください。";}}
  function panel(title,sub,body){return '<section class="panel"><header class="panelhead"><h2>'+title+'</h2><span class="tiny muted">'+sub+'</span></header><div class="panelbody">'+body+'</div></section>'}
  function statsCards(){
    const avg=Math.round(state.roster.reduce((a,b)=>a+average(b),0)/state.roster.length);
    const amount=state.race?(state.race.finished?"完走":("第"+Math.min(5,state.race.leg+1)+"区 "+((state.race.segment||0)+1)+"/3")):(state.week>=12?"大会直前":"練習中");
    return '<div class="statgrid">'+[
      ["シーズン",state.year+"年目",state.week+"/12週 "+amount],
      ["部費残高",yen(state.cash),"収支は年次決算で確認"],
      ["チーム総合力",avg,"全選手の能力平均"],
      ["全国制覇",state.awards+"回","強豪・北稜大学に挑戦"]
    ].map(a=>'<div class="stat"><div class="name">'+a[0]+'</div><div class="value">'+a[1]+'</div><div class="meta">'+a[2]+'</div></div>').join("")+'</div>'
  }
  function training(){
    const disabled=state.week>=12||!!state.race;
    const selects=E.SKILLS.map(s=>'<option value="'+s+'">'+skillLabels[s]+'</option>').join("");
    return panel("週間トレーニング","年間12週を圧縮したシーズン","<p class='muted tiny'>選んだ能力を10名全員が鍛えます。出走予定の5名は合宿・測定の特別効果を受けます。疲労が高いと練習効率が低下します。</p><div class='controlrow'><div class='field'><label for='focus'>育成項目</label><select id='focus'>"+selects+"</select></div><div class='field'><label for='intensity'>練習強度</label><select id='intensity'><option value='light'>調整練習（¥38,000）</option><option value='normal' selected>通常練習（¥72,000）</option><option value='hard'>高強度（¥110,000）</option></select></div><button class='btn' data-action='train' "+(disabled?"disabled":"")+">次の週へ進む →</button></div><div class='divider'></div><div class='flex'><span class='pill'>"+state.week+" / 12週</span><span class='muted tiny'>3D表示・通信なし / セーブ対応</span></div>")
  }
  function runners(){
    const d=state.roster.map(r=>'<tr><td><strong>'+esc(r.name)+'</strong><div class="mini muted">'+r.grade+'年生'+(r.grade===4?'・最終学年':'')+'</div><div class="mini green">PB: '+(Object.entries(r.records||{}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([km,seconds])=>km+'km '+time(seconds)).join(' / ')||'未記録')+'</div></td>'+E.SKILLS.map(k=>'<td class="num">'+dec(r.stats[k])+'</td>').join("")+'<td><div class="bar"><div class="fill '+(r.fatigue>=55?'warn':'')+'" style="width:'+Math.round(r.fatigue)+'%"></div></div><span class="mini muted">'+Math.round(r.fatigue)+'/100</span></td><td class="num">'+Math.round(r.morale)+'</td></tr>').join("");
    return panel("選手名鑑","卒業・新入部員あり",'<div class="tablewrap"><table><thead><tr><th>選手</th>'+E.SKILLS.map(k=>'<th class="num">'+skillLabels[k]+'</th>').join("")+'<th>疲労</th><th class="num">士気</th></tr></thead><tbody>'+d+'</tbody></table></div><p class="muted tiny">能力が高くても、当日の調子や終盤の粘り次第で結果は変わります。</p>')
  }
  function lineup(){
    const rows=E.LEGS.map((leg,i)=>'<div class="line"><div style="min-width:120px"><strong>'+leg.title+'</strong><div class="tiny muted">'+leg.km+'km</div></div><div class="field"><label for="leg-'+i+'">出走選手</label><select id="leg-'+i+'" '+(state.race?"disabled":"")+'>'+state.roster.map(r=>'<option value="'+r.id+'" '+(state.lineup[i]===r.id?"selected":"")+'>'+esc(r.name)+'（'+r.grade+'年・総合'+average(r)+'）</option>').join("")+'</select></div></div>').join("");
    return panel("区間配置","5区間 / 合計50km",rows+'<div style="margin-top:12px"><button class="btn secondary" data-action="lineup" '+(state.race?"disabled":"")+'>区間配置を確定</button></div>')
  }
  function store(){
    const shop=Object.entries(E.SHOP).map(([key,item])=>'<div class="shopcard"><div><strong>'+esc(item.name)+'</strong><p>'+esc(item.desc)+'</p>'+(state.items[key]?'<span class="pill">保有 '+state.items[key]+'個</span>':'')+'</div><button class="btn small secondary" data-action="buy" data-key="'+key+'" '+((state.race||state.week>=12||state.cash<item.cost)?"disabled":"")+'>'+yen(item.cost)+'</button></div>').join("");
    const recruitment='<div class="shopcard"><div><strong>来年度のスカウト活動</strong><p>高校生の視察・勧誘。翌年度の新入生の能力が上昇します（年最大3回）。費用は部費から支出。</p><span class="pill">今年度 '+(state.scouting||0)+'/3回</span></div><button class="btn small secondary" data-action="scout" '+((state.race||state.week>=12||(state.scouting||0)>=3||state.cash-180000<480000+(12-state.week)*38000)?"disabled":"")+'>¥180,000</button></div>';
    const invite=state.offer?'<div class="shopcard" style="border-color:#dbb777;background:#2e3230"><div><strong class="accent">★ 抽選で合同合宿に招待！</strong><p>部費¥260,000で次回の選抜5名の成長が2倍。残り期限：第'+state.offer.expires+'週まで。</p></div><button class="btn small" data-action="buy" data-key="invite" '+(state.race||state.week>=12||state.cash-260000<480000+(12-state.week)*38000?"disabled":"")+'>招待を使う</button></div>':'';
    return panel("部費で購入する支援・備品","魔法アイテムなし",'<p class="tiny muted">支援効果はゲーム用に誇張していますが、合宿・測定・補給・装備など実在する活動に費用を割り当てています。購入費は全額その年度に記帳します。</p>'+recruitment+invite+shop)
  }
  // No 3D characters: a schematic 2D route with distance-scaled checkpoint markers.
  function courseMap(){
    const race=state.race;if(!race)return "";
    const kmFinished=E.LEGS.slice(0,race.leg).reduce((n,x)=>n+x.km,0)+(race.leg<5?E.LEGS[race.leg].km*(race.segment||0)/3:0);
    const points=[[19,107],[75,51],[129,82],[182,28],[233,92],[278,48],[321,39]];
    const pos=f=>{let t=Math.min(.999999,Math.max(0,f))*(points.length-1),i=Math.floor(t),a=t-i;return [points[i][0]*(1-a)+points[i+1][0]*a,points[i][1]*(1-a)+points[i+1][1]*a]};
    const leader=race.contestants.length?Math.min(...race.contestants.map(c=>c.total)):0;
    const dots=race.contestants.map((c,i)=>{
      const last=c.splits.at(-1),secKm=last?.pace>0?last.pace:216;
      const distance=Math.max(0,kmFinished-Math.max(0,c.total-leader)/secKm),[x,y]=pos(distance/50);
      const fill=c.human?"#e7c076":c.boss?"#db786f":(["#8accc4","#8ab1d5","#a6a5db","#e8a4b1","#88bf9d","#bfcab5"][i%6]);
      // Screen-space fan-out prevents all eight teams overlapping at photo-finish precision.
      // Rank labels are schematic; the exact time gaps remain in the ranking table.
      const markerX=Math.max(13,Math.min(327,x+(i%2?4:-4)));
      const markerY=Math.max(10,Math.min(118,Math.max(45,Math.min(83,y))+(i-3.5)*10));
      return '<g><line x1="'+x.toFixed(1)+'" y1="'+y.toFixed(1)+'" x2="'+markerX.toFixed(1)+'" y2="'+markerY.toFixed(1)+'" stroke="'+fill+'" stroke-width="1.3" opacity=".65"/><circle cx="'+markerX.toFixed(1)+'" cy="'+markerY.toFixed(1)+'" r="8.4" fill="'+fill+'" stroke="#10222d" stroke-width="2"><title>'+esc(c.name)+'・'+(i+1)+'位</title></circle><text x="'+markerX.toFixed(1)+'" y="'+(markerY+3.1).toFixed(1)+'" fill="#10222d" font-size="9" font-weight="bold" text-anchor="middle">'+(i+1)+'</text>'+(c.human?'<circle cx="'+markerX.toFixed(1)+'" cy="'+markerY.toFixed(1)+'" r="11.3" fill="none" stroke="#f7e7b6" stroke-width="1.5"/>':'')+'</g>';
    }).join("");
    const course=points.map(p=>p.join(",")).join(" ");
    return '<div class="course" role="img" aria-label="各大学の走行位置を示す2Dコース図"><svg viewBox="0 0 340 128" width="100%" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="338" height="126" rx="11" fill="#233b3c"/><polyline points="'+course+'" fill="none" stroke="#516b63" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/><polyline points="'+course+'" fill="none" stroke="#dfcfa8" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><polyline points="'+course+'" fill="none" stroke="#fff3d8" stroke-width="1.5" stroke-dasharray="2 5"/><text x="16" y="122" fill="#e4e8df" font-size="10">START</text><text x="278" y="20" fill="#e4e8df" font-size="10">FINISH</text>'+dots+'</svg></div><div class="line tiny"><span class="muted">進行距離 '+kmFinished.toFixed(1)+' / 50km</span><span><span class="accent">●</span> 自校　<span style="color:#db786f">●</span> 北稜</span></div><div class="tiny muted" style="margin-bottom:10px">※マーカーは重なりを防ぐため縦に分離した模式表示。正確な差は順位表のタイムを参照。</div>';
  }
  function standing(){
    if(!state.race)return "";
    const race=state.race,sorted=race.contestants;
    const human=race.contestants.find(c=>c.human);
    const currentName=human?.splits?.at(-1)?.runner||state.roster.find(r=>r.id===state.lineup[race.leg])?.name||"第1区の走者";
    const energy=Number.isFinite(human?.energy)?Math.round(human.energy):null;
    const energyWidget='<div class="energy-card"><div class="line"><strong>体力・ペース配分</strong><span class="tiny muted">'+esc(currentName)+'</span></div>'+(
      energy===null?'<div class="tiny muted">大会開始。ペース指示後に走者の体力が表示されます。</div>':
      '<div class="bar" style="height:12px"><div class="fill '+(energy<35?"warn":"")+'" style="width:'+energy+'%"></div></div><div class="tiny muted" style="margin-top:6px">残存体力：'+energy+'/100　・'+(race.finished?'完走しました。':'次の区間で走者が交代します。')+'</div>'
    )+'</div>';
    return energyWidget+courseMap()+'<div class="track">'+E.LEGS.map((leg,i)=>'<div class="seg '+(i<race.leg?"done":i===race.leg?"now":"")+'">'+(i+1)+'区<small>'+leg.km+'km</small></div>').join("")+'</div>'+
      '<div class="loglist">'+sorted.map((c,i)=>'<div class="ranking"><div class="ranknum">'+(i+1)+'</div><div class="'+(c.human?"green strong":c.boss?"accent strong":"")+'">'+esc(c.name)+(c.boss?" ★強豪":"")+'</div><div class="ranktime">'+time(c.total)+(i?(' / +'+time(c.total-sorted[0].total)):' / 先頭')+'</div></div>').join("")+'</div>'+
      (race.notes.length?'<div class="divider"></div><div class="tiny muted">'+race.notes.slice(-3).reverse().map(x=>esc(x.leg+'区：'+x.text)).join('<div style="margin-top:5px"></div>')+'</div>':"");
  }
  function racing(){
    if(!state.race){
      if(state.week<12)return panel("全国大学駅伝","北稜大学が連覇中",'<p class="muted">全12週の育成を終えると、CPU7大学と5区間の駅伝に挑めます。強豪は高い能力を持ちますが、想定外の失速や最終学年の粘りもあります。</p><div class="pill">あと '+(12-state.week)+' 週で大会</div>');
      return panel("全国大学駅伝","全8大学・50km",'<p class="muted">大会開始後、区間ごとにペース作戦を選択して順位を競います。出場には遠征費¥480,000が必要です。</p><button class="btn" data-action="start" '+(state.cash<480000?"disabled":"")+'>大会を開始する →</button>');
    }
    const r=state.race;
    const info='<div class="flex"><span class="pill">'+r.weather+'</span><span class="pill">'+(r.finished?"全区間終了":'次は'+E.LEGS[r.leg].title)+'</span><span class="pill">'+(r.rank===null?'スタート前':'現在 '+r.rank+' 位')+'</span></div>';
    const choice=r.finished?'<div class="notice"><strong>'+r.rank+'位でゴール！</strong><br>'+(r.rank===1?'全国優勝です！強豪校の連覇を阻止しました。':'大学の年間記録を確認し、翌シーズンで挑みましょう。')+'</div><button class="btn" data-action="close">年度決算を確定して次年度へ →</button>':'<div class="controlrow"><div class="field"><label for="strategy">次チェックポイントの指示</label><select id="strategy"><option value="save">体力温存</option><option value="steady" selected>標準ペース</option><option value="push">積極策・攻め</option></select></div><button class="btn" data-action="next">次の地点へ →</button><button class="btn secondary" data-action="skip">区間終了まで進む</button></div><p class="muted tiny">各区間を3分割（全15地点）。攻めは体力消費32、標準21、温存13。使い切ると終盤に失速します。</p>';
    return panel("全国大学駅伝","レース進行中",info+standing()+'<div class="divider"></div>'+choice)
  }
  function finance(){
    const f=E.financials(state),entries=[...f.entries].reverse();
    return panel("年度決算・資金繰り",state.year+"年度 / 現金主義",'<div class="account"><div><label>収入</label><strong class="green">'+yen(f.income)+'</strong></div><div><label>支出</label><strong class="red">'+yen(f.expenses)+'</strong></div><div><label>収支</label><strong>'+yen(f.net)+'</strong></div></div><div class="line tiny"><span class="muted">期首残高</span><strong>'+yen(f.opening)+'</strong></div><div class="line tiny"><span class="muted">期末予測残高（現在）</span><strong>'+yen(f.ending)+'</strong></div><details class="collapse"><summary class="tiny">収支明細を開く（'+entries.length+'件）</summary><div class="ledger"><table><thead><tr><th>週</th><th>費目</th><th>内容</th><th class="num">収支</th></tr></thead><tbody>'+entries.map(x=>'<tr><td>'+x.week+'</td><td>'+esc(x.kind)+'</td><td>'+esc(x.label)+'</td><td class="num '+(x.amount>=0?"green":"red")+'">'+(x.amount>=0?"+":"")+yen(x.amount)+'</td></tr>').join("")+'</tbody></table></div></details><p class="muted mini">大学配分・卒業生支援は架空のモデル額です。寄付は賞金ではなく活動支援として計上。赤字取引は禁止し、残高は年度をまたいで繰り越します。</p>')
  }
  function history(){
    if(!state.history.length)return panel("歴代成績","周回するほど強くなる","<p class='muted tiny'>シーズン終了後、最終順位と年度決算がここに残ります。4年生は卒業し、新入部員が加入します。</p>");
    const rows=[...state.history].reverse().map(h=>'<tr><td>'+h.year+'年目</td><td class="num '+(h.rank===1?"green":"")+'">'+h.rank+'位</td><td>'+esc(h.winner)+'</td><td class="num">'+yen(h.finance.income)+'</td><td class="num">'+yen(h.finance.expenses)+'</td><td class="num">'+yen(h.finance.net)+'</td><td class="num">'+yen(h.finance.ending)+'</td></tr>').join("");

    const standings=[...state.history].reverse().filter(h=>Array.isArray(h.standings)).map(h=>{
      const rows=h.standings.map(c=>'<tr><td class="num">'+c.rank+'</td><td>'+esc(c.name)+'</td><td class="num">'+time(c.seconds)+'</td></tr>').join("");
      return '<details class="collapse"><summary class="tiny">'+h.year+'年目の全国駅伝・最終順位（8大学）</summary><div class="tablewrap"><table><thead><tr><th class="num">順位</th><th>大学名</th><th class="num">総合タイム</th></tr></thead><tbody>'+rows+'</tbody></table></div></details>';
    }).join("");
    const alumni=Array.isArray(state.alumni)&&state.alumni.length?'<details class="collapse"><summary class="tiny">卒業生の記録（'+state.alumni.length+'名）</summary><div class="tablewrap"><table><thead><tr><th>卒業生</th><th>卒業年度</th><th>記録</th></tr></thead><tbody>'+[...state.alumni].reverse().map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+r.graduationYear+'年目</td><td>'+Object.entries(r.records||{}).map(([k,v])=>k+'km '+time(v)).join(' / ')+'</td></tr>').join('')+'</tbody></table></div></details>':'';
    const reports=[...state.history].reverse().map(h=>{const f=E.financials(state,h.year);return '<details class="collapse"><summary class="tiny">'+h.year+'年目の決算明細（'+f.entries.length+'件）</summary><div class="ledger"><table><thead><tr><th>週</th><th>費目</th><th>内容</th><th class="num">金額</th></tr></thead><tbody>'+f.entries.map(x=>'<tr><td>'+x.week+'</td><td>'+esc(x.kind)+'</td><td>'+esc(x.label)+'</td><td class="num">'+yen(x.amount)+'</td></tr>').join("")+'</tbody></table></div></details>'}).join("");
    return panel("歴代成績・年度決算","全年度の明細を保存",'<div class="tablewrap"><table><thead><tr><th>年</th><th class="num">順位</th><th>優勝校</th><th class="num">収入</th><th class="num">支出</th><th class="num">収支</th><th class="num">期末残高</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+standings+alumni+reports);
  }

  function rivalDashboard(){
    if(!Array.isArray(state.rivalTeams))return "";
    const styles={speed:"スピード型",hill:"山岳重視",endurance:"持久力型",balanced:"総合力型"};
    const schools=[...state.rivalTeams].sort((a,b)=>(a.lastRank??99)-(b.lastRank??99));
    const cards=schools.map(team=>{
      const starters=team.lineup.map(id=>team.roster.find(r=>r.id===id)).filter(Boolean);
      const power=starters.length?Math.round(starters.reduce((n,r)=>n+average(r),0)/starters.length):0;
      const detail='<div class="tablewrap"><table><thead><tr><th>出走選手</th><th class="num">学年</th><th class="num">速</th><th class="num">持</th><th class="num">坂</th></tr></thead><tbody>'+starters.map(r=>'<tr><td>'+esc(r.name)+'</td><td class="num">'+r.grade+'</td><td class="num">'+Math.round(r.stats.speed)+'</td><td class="num">'+Math.round(r.stats.stamina)+'</td><td class="num">'+Math.round(r.stats.hill)+'</td></tr>').join("")+'</tbody></table></div>';
      return '<details class="rival-team"><summary><span><strong>'+esc(team.name)+'</strong>'+(team.boss?' <span class="accent">★ 王者</span>':'')+'<span class="tiny muted" style="display:block">'+(styles[team.style]||'育成型')+' / '+(team.lastRank?('昨季'+team.lastRank+'位'):'昨季の成績なし')+'</span></span><span class="tiny">総合 '+power+'　▾</span></summary><div class="rival-inside"><div class="line tiny"><span class="muted">大学の活動資金</span><strong>'+yen(team.cash)+'</strong></div><div class="line tiny"><span class="muted">当年度の収入 / 支出</span><strong>'+yen(team.finance.income)+' / '+yen(team.finance.expenses)+'</strong></div><div class="line tiny"><span class="muted">年間純収支 / 期首残高</span><strong>'+yen(team.finance.income-team.finance.expenses)+' / '+yen(team.finance.opening??0)+'</strong></div><p class="tiny muted">区間配置は各大学が自動判断します。選手は卒業し、次年度に新入生が加入します。</p>'+detail+'</div></details>';
    }).join("");
    return panel("ライバル大学の偵察","全7校が年間育成・会計・世代交代",'<p class="tiny muted">王者・北稜大学にも選手名簿と世代交代があります。順位は固定されず、その年の戦力と走りで決まります。</p>'+cards);
  }


  function tutorial(){
    const phase=state.race?(state.race.finished?"決算":("レース "+(state.race.leg+1)+"区")):(state.week>=12?"大会開始":"育成・準備");
    const hint=state.race?(state.race.finished?"次年度へ進む前に年間収支と大会順位を確認しましょう。":"温存・標準・攻めを選び、残存体力とタイム差を確認しましょう。"):
      state.week>=12?"5区間の出走選手を確定し、遠征費を確保して大会を開始しましょう。":
      "12週で育成を進めます。合宿は今の5人、スカウトは来年度の新入生に効きます。";
    return panel("監督手帳","現在の段階："+phase,'<p class="tiny">'+hint+'</p><details class="collapse"><summary class="tiny">基本操作と戦術のコツを読む</summary><ol class="tiny muted"><li>選手の得意な能力を見て5区間に配置</li><li>練習12週。疲労が高いと成長が落ちる</li><li>合宿・スカウト・回復は部費から出費</li><li>レースは各区間3地点、体力を見ながらペースを選ぶ</li><li>年度決算を確定すると4年生が卒業し新入部員が加入</li><li>最強の北稜大学も世代交代する。数年かけて全国優勝を狙おう</li></ol></details>');
  }

  function render(){
    const root=document.getElementById("app");
    root.innerHTML='<div class="wrap"><header class="top"><div><div class="eyebrow">University long-distance strategy</div><h1 class="brand">EKIDEN <span class="accent">MANAGER</span></h1><div class="sub">栄光への襷 — 育成 × レース戦術 × 部費経営</div></div><span class="tag">OFFLINE ALPHA v0.3</span></header>'+
      statsCards()+'<div class="notice">'+esc(flash||state.lastLog)+'</div><div class="layout"><div>'+
      racing()+training()+lineup()+runners()+'</div><aside>'+tutorial()+finance()+store()+rivalDashboard()+history()+'</aside></div>'+
      '<footer class="footer"><div>ゲームの選手・大学・財務は架空設定です。結果は乱数シードで再現可能です。</div><div class="flex"><button class="btn small ghost" data-action="export">セーブ書き出し</button><button class="btn small ghost" data-action="import">セーブ読込</button><button class="btn small danger" data-action="reset">最初から</button><input type="file" id="savefile" accept=".json,application/json" hidden/></div></footer></div>';
  }
  function execute(fn){flash="";try{fn();E.validate(state);persist();}catch(e){flash="操作できませんでした："+e.message;}render();}
  function exportSave(){const data=JSON.stringify(state,null,2),blob=new Blob([data],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="ekiden-manager-year-"+state.year+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  document.addEventListener("click",event=>{
    const button=event.target.closest("[data-action]");if(!button||button.disabled)return;
    const action=button.dataset.action;
    if(action==="export"){exportSave();return;}
    if(action==="import"){document.getElementById("savefile").click();return;}
    if(action==="reset"){if(confirm("今の進行状況を消し、初年度から始めますか？ セーブ書き出しを推奨します。")){state=E.newGame(seed());persist();render();}return;}
    execute(()=>{
      if(action==="train")E.train(state,document.getElementById("focus").value,document.getElementById("intensity").value);
      else if(action==="buy")E.buyItem(state,button.dataset.key);
      else if(action==="scout")E.investScouting(state);
      else if(action==="lineup")E.setLineup(state,E.LEGS.map((_,i)=>Number(document.getElementById("leg-"+i).value)));
      else if(action==="start")E.startRace(state);
      else if(action==="next")E.stepRace(state,document.getElementById("strategy").value);
      else if(action==="skip")E.nextLeg(state,document.getElementById("strategy").value);
      else if(action==="close")E.closeYear(state);
    });
  });
  document.addEventListener("change",event=>{
    if(event.target.id!=="savefile")return;
    const file=event.target.files[0];if(!file)return;
    file.text().then(text=>{if(text.length>8*1024*1024)throw Error("セーブファイルが大きすぎます");const imported=E.migrateSave(JSON.parse(text));state=imported;flash="セーブデータを読み込みました。";persist();render();}).catch(e=>{flash="読込失敗："+e.message;render()});
  });
  render();
})();
