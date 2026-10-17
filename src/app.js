/* EKIDEN MANAGER — zero-server, no dependencies. */
"use strict";
(() => {
  const E=globalThis.EkidenEngine, KEY="ekiden-manager-v1", LANG_KEY="ekiden-manager-language";
  let locale="ja";
  try{const stored=localStorage.getItem(LANG_KEY);if(["ja","en"].includes(stored))locale=stored;
  }catch(_e){locale="ja";}

  if(!E){document.getElementById("app").textContent="ゲームの読み込みに失敗しました。";return;}
  const yen=n=>"¥"+Math.round(n).toLocaleString("ja-JP");
  const dec=n=>Number(n).toFixed(1);
  const time=t=>{const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=Math.round(t%60);return (h?h+":"+String(m).padStart(2,"0"):String(m))+":"+String(s).padStart(2,"0")};
  const skillLabels={speed:"スピード",stamina:"スタミナ",hill:"登坂",grit:"精神力",recovery:"回復力"};
  const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const average=r=>Math.round((r.stats.speed+r.stats.stamina+r.stats.hill+r.stats.grit)/4);
  const seed=()=>{const n=new Uint32Array(1);if(globalThis.crypto?.getRandomValues){globalThis.crypto.getRandomValues(n);return n[0]||1;}return (Date.now()>>>0)||1;};
  let recoveryBlocked=false, corruptRaw=null;
  let state=load(), flash="",marketTeam="北稜大学",marketRank=1,marketStake=50000;
  function load(){let raw=null;try{raw=localStorage.getItem(KEY);if(raw){const s=E.migrateSave(JSON.parse(raw));return s;}}catch(e){recoveryBlocked=true;corruptRaw=raw;console.warn("セーブデータの読み込みに失敗:",e.message)}return E.newGame(seed())}
  function persist(){if(recoveryBlocked)return;try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){flash="自動保存できませんでした。下の「セーブ書き出し」を使用してください。";}}
  function panel(title,sub,body){return '<section class="panel"><header class="panelhead"><h2>'+title+'</h2><span class="tiny muted">'+sub+'</span></header><div class="panelbody">'+body+'</div></section>'}
  function statsCards(){
    const avg=Math.round(state.roster.reduce((a,b)=>a+average(b),0)/state.roster.length);
    const amount=state.race?(state.race.finished?"完走":("第"+Math.min(5,state.race.leg+1)+"区 "+((state.race.segment||0)+1)+"/3")):(state.week>=12?"大会直前":"練習中");
    return '<div class="statgrid">'+[
      ["シーズン",state.year+" / "+E.MAX_SEASONS+"年",state.week+"/12週 "+amount],
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
  function highSchoolRecruitment(){
    const schools=E.visibleScouting(state),scouted=schools.filter(h=>h.scouted);
    const locked=!!state.race||state.week>=12||(state.scouting||0)>=3;
    const list=schools.map(h=>'<option value="'+h.id+'" '+(h.scouted?'disabled':'')+'>'+esc(h.name)+'（'+h.region+'・'+h.style+'）'+(h.scouted?'・訪問済':'')+'</option>').join("");
    const reports=scouted.map(h=>'<div class="school-report"><div><strong>'+esc(h.name)+'</strong> <span class="pill">調査済</span><p class="tiny muted">'+esc(h.region)+' / '+esc(h.style)+' / '+h.prospects.length+'名発見</p></div><div class="school-prospects">'+h.prospects.map(p=>{
      const desc=E.SKILLS.map(k=>'<span>'+esc(k)+': '+p.approx[k]+'前後</span>').join(' ');
      return '<div class="recruit-candidate"><strong>'+esc(p.name)+'</strong>'+(p.talent?'<span class="talent-chip">★ '+esc(p.talent)+'</span>':'')+
        '<div class="tiny muted">高校3年 / 能力は視察時の概算値</div><div class="tiny">'+desc+'</div><button class="btn small '+(p.targeted?'secondary':'')+'" data-action="target" data-id="'+p.id+'" '+(state.race||state.week>=12?'disabled':'')+'>'+(p.targeted?'勧誘予約を解除':'この生徒に入部打診')+'</button></div>';
    }).join('')+'</div></div>').join('');
    return panel("全国高校スカウト","40校・候補者の能力と逸材の在籍校は訪問前には非公開",
      '<p class="tiny muted">視察先を選び、1校あたり'+yen(E.SCOUT_COST)+'で交通・調査・面談を実施します。年間3校まで。調査後に本人へ入部を打診できます（最大3名、辞退あり）。発掘した候補は次年度の新入生に反映されます。</p>'+
      '<div class="controlrow"><div class="field"><label for="scout-school">視察する高等学校</label><select id="scout-school">'+list+'</select></div><button class="btn" data-action="scout" '+(locked||state.cash-E.SCOUT_COST<480000+(12-state.week)*38000?'disabled':'')+'>視察 '+yen(E.SCOUT_COST)+'</button></div>'+
      '<div class="flex"><span class="pill">視察 '+(state.scouting||0)+' / 3校</span><span class="pill">勧誘予約 '+(state.recruitTargets||[]).length+' / 3名</span><span class="pill">未調査 '+(schools.length-scouted.length)+'校</span></div>'+
      (reports||'<p class="tiny muted">まだ高校を訪問していません。強豪の新入生がどこにいるかは隠されています。</p>'));
  }
  function schoolEvents(){
    const all=(state.events||[]).filter(e=>e.year===state.year).slice(-7).reverse();
    return panel("大学生活・突発イベント","好調も不調も育成と予算に反映",
      all.length?'<div class="event-feed">'+all.map(e=>'<div class="event-item"><div class="tiny muted">第'+e.week+'週 · EVENT</div><strong>'+esc(e.headline)+'</strong><p class="tiny">'+esc(e.detail)+'</p></div>').join('')+'</div>':'<p class="tiny muted">週次の練習を進めると、恋愛、故障、合同練習、栄養管理、地域の支援などが発生することがあります。</p>');
  }

  function runners(){
    const d=state.roster.map(r=>'<tr><td><strong>'+esc(r.name)+'</strong>'+(r.talent?'<span class="talent-chip">★ '+esc(r.talent)+'</span>':'')+'<div class="mini muted">'+r.grade+'年生'+(r.grade===4?'・最終学年':'')+'</div><div class="mini pressure">本番耐性 '+(r.traits.stage??55)+' / 失速リスク '+E.mentalRisk({stats:r.stats,stage:r.traits.stage,morale:r.morale}).choke.toFixed(1)+'%</div><div class="mini green">PB: '+(Object.entries(r.records||{}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([km,seconds])=>km+'km '+time(seconds)).join(' / ')||'未記録')+'</div></td>'+E.SKILLS.map(k=>'<td class="num">'+dec(r.stats[k])+'</td>').join("")+'<td><div class="bar"><div class="fill '+(r.fatigue>=55?'warn':'')+'" style="width:'+Math.round(r.fatigue)+'%"></div></div><span class="mini muted">'+Math.round(r.fatigue)+'/100</span></td><td class="num">'+Math.round(r.morale)+'</td><td class="num mental">'+Math.round(r.traits.consistency??60)+'</td><td class="num mental">'+Math.round(r.traits.stage??55)+'</td><td class="num mental">'+E.mentalRisk({stats:r.stats,stage:r.traits.stage,morale:r.morale}).choke.toFixed(1)+'%</td></tr>').join("");
    return panel("選手名鑑","卒業・新入部員あり",'<div class="tablewrap"><table><thead><tr><th>選手</th>'+E.SKILLS.map(k=>'<th class="num">'+skillLabels[k]+'</th>').join("")+'<th>疲労</th><th class="num">士気</th><th class="num">安定性</th><th class="num">本番耐性</th><th class="num">失速リスク</th></tr></thead><tbody>'+d+'</tbody></table></div><p class="muted tiny">精神力は基本走力にも影響。安定性は当日のブレ、本番耐性は大舞台で崩れる確率に影響。失速リスクは1区間当たりのゲーム上の確率です。精神力が高くても本番に弱い選手がいます。</p>')
  }
  function lineup(){
    const rows=E.LEGS.map((leg,i)=>'<div class="line"><div style="min-width:120px"><strong>'+leg.title+'</strong><div class="tiny muted">'+leg.km+'km</div></div><div class="field"><label for="leg-'+i+'">出走選手</label><select id="leg-'+i+'" '+(state.race||state.prediction?"disabled":"")+'>'+state.roster.map(r=>'<option value="'+r.id+'" '+(state.lineup[i]===r.id?"selected":"")+'>'+esc(r.name)+'（'+r.grade+'年・総合'+average(r)+'）</option>').join("")+'</select></div></div>').join("");
    return panel("区間配置","5区間 / 合計50km",rows+'<div style="margin-top:12px"><button class="btn secondary" data-action="lineup" '+(state.race||state.prediction?"disabled":"")+'>区間配置を確定</button></div>')
  }
  function store(){
    const protectedCash=480000+(12-state.week)*38000;
    const usableCash=Math.max(0,state.cash-protectedCash);
    const normalPlanCash=Math.max(0,state.cash-480000-(12-state.week)*72000);
    const shop=Object.entries(E.SHOP).map(([key,item])=>{
      const available=state.week<12&&!state.race&&state.cash-item.cost>=protectedCash&&(key==="elite"?(state.items.elite||0)===0:key==="recovery"||state.items[key]<2);
      return '<div class="shopcard'+(key==="elite"?' premium-item':'')+'"><div><strong>'+(key==="elite"?'★ 高額・高効果　':'')+esc(item.name)+'</strong><p>'+esc(item.desc)+'</p>'+(state.items[key]?'<span class="pill">'+(key==="elite"?'残り '+state.items[key]+'練習':'保有 '+state.items[key]+'個')+'</span>':'')+(key==="elite"?'<div class="tiny muted">通常練習と遠征費を残せる場合に購入できます。ほかの強化投資との両立は難しくなります。</div>':'')+'</div><button class="btn small secondary" data-action="buy" data-key="'+key+'" '+(available?'':'disabled')+'>'+yen(item.cost)+'</button></div>';
    }).join("");
    const invite=state.offer?'<div class="shopcard" style="border-color:#dbb777;background:#2e3230"><div><strong class="accent">★ 抽選で合同合宿に招待！</strong><p>部費¥260,000で次回の選抜5名の成長が2倍。残り期限：第'+state.offer.expires+'週まで。</p></div><button class="btn small" data-action="buy" data-key="invite" '+(state.race||state.week>=12||state.cash-260000<480000+(12-state.week)*38000?"disabled":"")+'>招待を使う</button></div>':'';
    return panel("部費で購入する支援・備品","最低練習・遠征を確保：残り"+yen(usableCash),'<p class="tiny muted">通常練習を残り全週続ける場合のアイテム購入余力：'+yen(normalPlanCash)+'。高額プログラムを購入すると他の支出を抑える必要があります。</p><p class="tiny muted">支援効果はゲーム用に誇張していますが、合宿・測定・補給・装備など実在する活動に費用を割り当てています。購入費は全額その年度に記帳します。</p>'+invite+shop)
  }
  // No 3D characters: a schematic 2D route with distance-scaled checkpoint markers.

  function courseMap(){
    const race=state.race;if(!race)return "";
    const covered=E.LEGS.slice(0,race.leg).reduce((n,l)=>n+l.km,0)+(race.leg<5?E.LEGS[race.leg].km*(race.segment||0)/3:0);
    const first=race.contestants.length?Math.min(...race.contestants.map(c=>c.total)):0;
    const rxs=[187,178,169,160,151,142,133,124],rys=[91,85,79,73,67,61,55,49];
    const lanes=rxs.map((rx,i)=>'<ellipse cx="230" cy="122" rx="'+rx+'" ry="'+rys[i]+'" fill="none" stroke="'+(i%2?"#56795f":"#719c77")+'" stroke-width="7.2" opacity=".92"/>').join("");
    const dots=race.contestants.map((c,i)=>{
      const pace=c.splits.length&&c.splits.at(-1).pace>0?c.splits.at(-1).pace:215;
      const progress=Math.max(0,covered-Math.max(0,c.total-first)/pace)/50;
      const angle=-Math.PI/2+2*Math.PI*progress;
      const x=230+rxs[i]*Math.cos(angle),y=122+rys[i]*Math.sin(angle);
      const fill=c.human?"#e6bf67":c.boss?"#e87966":(["#9bd6d0","#b3b1e1","#f1abca","#b7d389","#a8b8db","#d7ba97"][i%6]);
      return '<g class="race-marker"><circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(c.human?12:10)+'" fill="'+fill+'" stroke="#10232e" stroke-width="2"><title>'+esc(c.name)+' / '+(i+1)+'位</title></circle><text x="'+x.toFixed(1)+'" y="'+(y+3.4).toFixed(1)+'" fill="#14232b" text-anchor="middle" font-weight="900" font-size="10">'+(i+1)+'</text></g>';
    }).join("");
    return '<div class="race-live-bar"><span class="live-dot"></span><strong>EKIDEN LIVE</strong><span>全国大学駅伝　'+state.year+'年目</span><span class="race-live-right">'+(race.finished?'FINISH':('第'+(race.leg+1)+'区　'+((race.segment||0)+1)+'/3地点'))+'</span></div>'+
      '<div class="course" role="img" aria-label="競馬中継風の2D周回模式コース。大学ごとに色付きの順位番号を表示"><svg viewBox="0 0 460 245" width="100%" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="field" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#25473e"/><stop offset="100%" stop-color="#132d29"/></linearGradient></defs><rect x="1" y="1" width="458" height="243" rx="13" fill="url(#field)"/><ellipse cx="230" cy="122" rx="195" ry="99" fill="#2a5943" stroke="#a8c59d" stroke-width="1.5"/>'+lanes+'<ellipse cx="230" cy="122" rx="116" ry="42" fill="#18362f"/><text x="230" y="115" text-anchor="middle" fill="#e5ecdf" font-weight="900" font-size="19" letter-spacing="2">EKIDEN</text><text x="230" y="134" text-anchor="middle" fill="#c7dbcc" font-size="11">50 km CHAMPIONSHIP</text><path d="M229 14V53" stroke="#f6e5cb" stroke-width="3" stroke-dasharray="5 4"/><text x="240" y="20" font-size="10" fill="#fff2d1">GOAL</text>'+dots+'</svg></div>'+
      '<div class="race-progress"><div class="race-progress-fill" style="width:'+Math.round(covered/50*100)+'%"></div></div>'+
      '<div class="line tiny"><span>'+covered.toFixed(1)+' / 50 km</span><span><span class="accent">●</span> 自校　<span style="color:#e87966">●</span> 北稜大学</span></div>'+
      '<p class="mini muted">競馬中継をイメージした模式図です。正確なタイム差は下の順位表で確認してください。</p>';
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
    const human=r.contestants.find(c=>c.human);
    const moisture=human&&Number.isFinite(human.hydration)?Math.round(human.hydration):62;
    const belly=human&&Number.isFinite(human.stomach)?Math.round(human.stomach):0;
    const condition=r.finished?'':'<div class="pit-gauges"><div><div class="line tiny"><span>選手の水分コンディション</span><strong>'+moisture+'/100</strong></div><div class="bar"><div class="fill" style="width:'+moisture+'%"></div></div></div><div><div class="line tiny"><span>胃の負担（多いほど不利）</span><strong>'+belly+'/120</strong></div><div class="bar"><div class="fill warn" style="width:'+Math.min(100,Math.round(belly/120*100))+'%"></div></div></div></div>';
    const mentalLeg=human&&human.mentalOutcome?'<div class="mental-live">大会メンタル：'+(human.mentalOutcome==="choke"?"緊張で失速":human.mentalOutcome==="flow"?"ゾーンに突入":"普段どおり")+' / 本番のペース補正 '+(human.mentalPace||0).toFixed(1)+' 秒/km</div>':'';
    const info='<div class="flex"><span class="pill">'+r.weather+'</span><span class="pill">'+(r.finished?"全区間終了":'次は'+E.LEGS[r.leg].title)+'</span><span class="pill">'+(r.rank===null?'スタート前':'現在 '+r.rank+' 位')+'</span></div>'+condition+mentalLeg;
    const choice=r.finished?('<div class="finish-banner '+(state.ending==="lost"?"defeat":r.rank===1?"victory":"")+'"><div class="eyebrow">'+(state.ending==="lost"?"GAME OVER":r.rank===1?"CHAMPION":"RACE FINISHED")+'</div><strong>'+r.rank+'位でゴール！</strong><div class="tiny">'+(state.ending==="won"?"8年間の挑戦達成！":state.ending==="lost"?"8年間で全国優勝できず、監督生活は終了です。":r.rank===1?"全国優勝達成！続きの年度もプレイできます。":"年間記録を見て、来季の強化につなげましょう。")+'</div></div>'+
      (state.prediction?'<div class="notice">順位予想：'+(state.prediction.status==="won"?"的中！ "+yen(state.prediction.payout)+"を部費に加算しました。":"不的中。購入額は部費の支出になりました。")+'</div>':'')+
      (state.ending?'<button class="btn secondary" data-action="reset">新しい監督生活を始める</button>':'<button class="btn" data-action="close">年度決算を確定して次年度へ →</button>')):
      '<div class="hydration-panel"><div class="eyebrow">RACE PIT STRATEGY — 給水ステーション</div><div class="line tiny"><span>大会中の給水費用</span><strong>'+yen(r.waterSpent||0)+'</strong></div><div class="line tiny"><span>給水に使える部費</span><strong>'+yen(state.cash)+'</strong></div><div class="controlrow"><div class="field"><label for="strategy">走行ペース</label><select id="strategy"><option value="save">体力温存</option><option value="steady" selected>標準ペース</option><option value="push">積極策・攻め</option></select></div><div class="field"><label for="water">渡す水の数（1杯＝'+yen(E.WATER_COST)+'）</label><select id="water"><option value="0">0杯・無料（水分不足リスク）</option><option value="1" selected>1杯・'+yen(E.WATER_COST)+'</option><option value="2">2杯・'+yen(E.WATER_COST*2)+'</option><option value="3">3杯・'+yen(E.WATER_COST*3)+'</option></select></div></div><div class="flex"><button class="btn" data-action="next">給水と走行を確定 →</button><button class="btn secondary" data-action="skip">この区間をまとめて進む</button></div><p class="muted tiny">1杯が基本。給水不足は脱水による失速、連続した大量給水は腹部の重さによる失速につながります。余った部費を勝負どころに使えます。まとめて進む場合も選択した給水量を各地点で適用します。</p></div>';
        return panel("全国大学駅伝","レース進行中",info+standing()+'<div class="divider"></div>'+choice)
  }
  function finance(){
    const f=E.financials(state),entries=[...f.entries].reverse();
    return panel("年度決算・資金繰り",state.year+"年度 / 現金主義",'<div class="account"><div><label>収入</label><strong class="green">'+yen(f.income)+'</strong></div><div><label>支出</label><strong class="red">'+yen(f.expenses)+'</strong></div><div><label>収支</label><strong>'+yen(f.net)+'</strong></div></div><div class="line tiny"><span class="muted">期首残高</span><strong>'+yen(f.opening)+'</strong></div><div class="line tiny"><span class="muted">期末予測残高（現在）</span><strong>'+yen(f.ending)+'</strong></div><details class="collapse"><summary class="tiny">収支明細を開く（'+entries.length+'件）</summary><div class="ledger"><table><thead><tr><th>週</th><th>費目</th><th>内容</th><th class="num">収支</th></tr></thead><tbody>'+entries.map(x=>'<tr><td>'+x.week+'</td><td>'+esc(x.kind)+'</td><td>'+esc(x.label)+'</td><td class="num '+(x.amount>=0?"green":"red")+'">'+(x.amount>=0?"+":"")+yen(x.amount)+'</td></tr>').join("")+'</tbody></table></div></details><p class="muted mini">大学配分・卒業生支援は架空のモデル額です。寄付は賞金ではなく活動支援として計上。赤字取引は禁止し、残高は年度をまたいで繰り越します。</p>')
  }

  function predictionMarket(){
    const P=globalThis.EkidenPrediction;
    if(!P)return "";
    if(state.prediction){
      const b=state.prediction,level=b.status==="placed"?"投票受付終了":b.status==="won"?"的中！":"不的中";
      const outcome=b.status==="placed"?"大会終了後に順位が確定します（購入後の区間配置は固定）":'実際の順位 '+b.actualRank+'位 / 払戻し '+yen(b.payout||0);
      return panel("レース順位予想・投票券",level,'<div class="ticket"><div class="eyebrow">VIRTUAL PREDICTION</div><div class="ticket-title">'+esc(b.team)+'　'+b.rank+'位</div><div class="line"><span>確定オッズ <strong>×'+b.odds.toFixed(1)+'</strong></span><span>部費支出 '+yen(b.stake)+'</span></div><div class="line"><span>想定的中確率 '+b.probability+'%</span><span class="'+(b.status==="won"?"green":"accent")+'">'+level+'</span></div><p class="tiny">'+outcome+'</p></div><div class="mini muted">現実のお金・換金・景品・オンライン賭博は一切ありません。ゲーム内予測イベントです。</div>');
    }
    if(state.week!==12||state.race||state.ending)return panel("順位予想ボード","育成12週が終了すると解禁","<p class='tiny muted'>大会前に、選手の能力から推定した倍率を見て、部費で順位を予想できます。ゲーム内専用・換金不可。</p>");
    const qs=P.quotes(state);
    if(!qs.some(q=>q.name===marketTeam))marketTeam=qs[0].name;
    const chosen=qs.find(q=>q.name===marketTeam), quote=chosen.ranks[marketRank-1], forecast=P.meta(state);
    const row=qs.map((q,i)=>'<tr class="'+(q.name===marketTeam?"human":"")+'"><td class="num">'+(i+1)+'</td><td>'+esc(q.name)+'</td><td class="num">'+q.strength+'</td><td class="num">'+q.ranks[marketRank-1].probability+'%</td><td class="num strong">'+q.ranks[marketRank-1].odds.toFixed(1)+'倍</td></tr>').join("");
    const options=qs.map(q=>'<option value="'+esc(q.name)+'" '+(marketTeam===q.name?"selected":"")+'>'+esc(q.name)+'</option>').join("");
    return panel("レース順位予想・オッズ","部費で挑戦 / 1年につき1口",
      '<div class="controlrow"><div class="field"><label for="market-team">予想する大学</label><select id="market-team">'+options+'</select></div><div class="field"><label for="market-rank">順位</label><select id="market-rank">'+Array.from({length:8},(_,i)=>'<option value="'+(i+1)+'" '+(marketRank===i+1?"selected":"")+'>'+(i+1)+'位</option>').join("")+'</select></div><div class="field"><label for="market-stake">部費を使う額</label><select id="market-stake">'+Array.from({length:39},(_,i)=>20000+i*10000).map(v=>'<option value="'+v+'" '+(marketStake===v?"selected":"")+'>'+yen(v)+'</option>').join("")+'</select></div></div>'+
      '<div class="odds-board"><div class="eyebrow">PREDICTION BOARD — '+state.year+'年目</div><div class="tiny muted">予想順位：'+marketRank+'位 / '+forecast.samples+'回のレース試算（晴'+forecast.dry+'・雨'+forecast.rain+'）による推定値</div><div class="tablewrap"><table><thead><tr><th class="num">枠</th><th>大学</th><th class="num">戦力</th><th class="num">推定確率</th><th class="num">倍率</th></tr></thead><tbody>'+row+'</tbody></table></div></div>'+
      '<div class="tiny muted" style="margin-top:10px;margin-bottom:4px">選択した大学・順位の試算着順：'+quote.sampleWins+' / '+forecast.samples+'回（'+quote.probability+'%、95%試算誤差幅 '+quote.range[0]+'〜'+quote.range[1]+'%）。天候や戦術による不確実性があり、実際の的中率は保証されません。</div>'+'<div class="ticket-preview"><div><div class="tiny muted">選択オッズ</div><strong>×'+quote.odds.toFixed(1)+'</strong></div><div><div class="tiny muted">的中時の合計払戻し</div><strong>'+yen(Math.floor(marketStake*quote.odds))+'</strong></div><div><div class="tiny muted">はずれた場合</div><strong class="red">−'+yen(marketStake)+'</strong></div></div>'+
      '<button class="btn" data-action="prediction" '+(state.cash-marketStake<480000?"disabled":"")+'>この予想を確定する</button><p class="tiny muted">部費残高から購入額を差し引きます。確定後の変更・払戻しは不可。購入額は1万円刻み、遠征費48万円を必ず確保します。1.0倍の場合は的中しても差引利益0円です。倍率は最大16倍。予想は任意で、購入せず大会に進めます。</p>');
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
      const starters=E.selectRivalLineup(team).map(id=>team.roster.find(r=>r.id===id)).filter(Boolean);
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
      "12週で育成を進めます。全国40高校から視察先を選び、費用を払って選手を探しましょう。";
    return panel("監督手帳","現在の段階："+phase,'<p class="tiny">'+hint+'</p><details class="collapse"><summary class="tiny">基本操作と戦術のコツを読む</summary><ol class="tiny muted"><li>選手の得意な能力を見て5区間に配置</li><li>練習12週。疲労が高いと成長が落ちる</li><li>合宿・スカウト・回復は部費から出費</li><li>レースは各区間3地点、体力を見ながらペースを選ぶ</li><li>年度決算を確定すると4年生が卒業し新入部員が加入</li><li>最強の北稜大学も世代交代する。数年かけて全国優勝を狙おう</li></ol></details>');
  }

  function coachNextAction(){
    // Guidance is read-only: no RNG consumption and no save modification.
    if(state.ending){
      return {phase:"監督としての8年間",title:"これまでの挑戦を振り返ろう",
        action:"最終成績を確認し、新しい挑戦を始めるか決めましょう。"};
    }
    if(state.race){
      return state.race.finished
        ? {phase:"大会終了",title:"戦いの結果が次の一年につながる",
           action:"区間順位と大会結果を確認したら、年度決算へ進みましょう。"}
        : {phase:"全国大学駅伝",title:"ここからは、あなたのペース指示で勝負が変わる",
           action:"残り体力とタイム差を確認し、「温存」「標準」「攻め」から選んでください。"};
    }
    if(state.week>=12){
      return {phase:"大会への準備",title:"育てた5人で、強豪大学に挑む",
        action:"5区間の出走選手と遠征費を確認し、大会を開始しましょう。"};
    }
    return {phase:"新年度の育成",title:"あと"+(12-state.week)+"週。自分だけのチームを強くしよう",
      action:"育成項目と練習強度を選んで一週進めましょう。スカウトや合宿も選べます。"};
  }
  function coachOrientation(){
    const next=coachNextAction();
    return '<section class="coach-orientation" aria-label="現在の目標">'+
      '<span class="coach-phase">'+esc(next.phase)+'</span>'+
      '<h2>'+esc(next.title)+'</h2><p>'+esc(next.action)+'</p>'+
      '<details><summary>ゲームの流れを確認する</summary><ol>'+
      '<li>選手を育て、疲労や部費を管理する</li>'+
      '<li>5人の区間を決め、15地点で戦術を指示する</li>'+
      '<li>年度決算と世代交代を経て全国優勝を目指す</li>'+
      '</ol></details></section>';
  }
  function render(){
    const root=document.getElementById("app");
    root.innerHTML='<div class="wrap"><header class="top"><div><div class="eyebrow">University long-distance strategy</div><h1 class="brand">EKIDEN <span class="accent">MANAGER</span></h1><div class="sub">栄光への襷 — 育成 × レース戦術 × 部費経営</div></div><div class="language-switch" role="group" aria-label="表示言語 / Display language"><button type="button" class="btn small ghost language-button" data-action="locale" data-lang="ja" aria-pressed="'+(locale==="ja")+'">日本語</button><button type="button" class="btn small ghost language-button" data-action="locale" data-lang="en" aria-pressed="'+(locale==="en")+'">English</button><span class="tag">OFFLINE ALPHA v0.7.0 · JP/EN</span></div></header>'+
      (recoveryBlocked?'<section class="save-recovery" role="alert"><strong>保存記録を安全に読み込めませんでした。</strong><p>元のセーブデータは上書きしていません。元データを退避してから新規開始するか、正常なセーブを読み込んでください。</p><div class="flex"><button class="btn secondary" data-action="export-corrupt">元のセーブをファイルに退避</button><button class="btn danger" data-action="reset">新しいゲームを開始</button></div></section>':'')+
      coachOrientation()+statsCards()+'<div class="notice">'+esc(flash||state.lastLog)+'</div><div class="layout"><div>'+ 
      (state.week<12&&!state.race&&!state.ending?highSchoolRecruitment():'')+(state.week>=12&&!state.race&&!state.ending?predictionMarket():'')+racing()+training()+(state.week>=12||!!state.race?highSchoolRecruitment():'')+schoolEvents()+lineup()+runners()+'</div><aside>'+tutorial()+(state.week>=12&&!state.race&&!state.ending?'':predictionMarket())+'<details class="coach-advanced"><summary>部費・補強・他校分析・過去の結果（詳細）</summary>'+finance()+store()+rivalDashboard()+history()+'</details></aside></div>'+
      '<footer class="footer"><div>ゲームの選手・大学・財務は架空設定です。結果は乱数シードで再現可能です。</div><div class="flex"><button class="btn small ghost" data-action="export">セーブ書き出し</button><button class="btn small ghost" data-action="import">セーブ読込</button><button class="btn small danger" data-action="reset">最初から</button><input type="file" id="savefile" accept=".json,application/json" hidden/></div></footer></div>';
    const root2=document.getElementById("app");
    if(globalThis.EkidenI18n&&root2&&root2.ownerDocument)globalThis.EkidenI18n.localize(root2,locale);
  }
  function execute(fn){if(recoveryBlocked){flash="保存記録を退避するか、正常なセーブを読み込んでから操作してください。";render();return;}flash="";const checkpoint=JSON.stringify(state);try{fn();E.validate(state);persist();}catch(e){state=JSON.parse(checkpoint);flash="操作できませんでした："+e.message;}render();}
  function exportSave(){const data=JSON.stringify(state,null,2),blob=new Blob([data],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="ekiden-manager-year-"+state.year+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  document.addEventListener("click",event=>{
    const button=event.target.closest("[data-action]");if(!button||button.disabled)return;
    const action=button.dataset.action;
    if(action==="locale"){
      const next=button.dataset.lang;
      if(!["ja","en"].includes(next))return;
      locale=next;
      try{localStorage.setItem(LANG_KEY,locale);}catch(_e){}
      render();return;
    }
    if(action==="export-corrupt"){
      if(recoveryBlocked&&corruptRaw!==null){
        const blob=new Blob([corruptRaw],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
        a.href=url;a.download="ekiden-manager-recovery-original.json";document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      }return;
    }
    if(action==="export"){exportSave();return;}
    if(action==="import"){document.getElementById("savefile").click();return;}
    if(action==="reset"){if(confirm(recoveryBlocked?"読込できない元のセーブを新規ゲームで置き換えます。先に退避ファイルを保存しましたか？":"今の進行状況を消し、初年度から始めますか？ セーブ書き出しを推奨します。")){recoveryBlocked=false;corruptRaw=null;state=E.newGame(seed());persist();render();}return;}
    execute(()=>{
      if(action==="train")E.train(state,document.getElementById("focus").value,document.getElementById("intensity").value);
      else if(action==="buy")E.buyItem(state,button.dataset.key);
      else if(action==="scout")E.investScouting(state,Number(document.getElementById("scout-school").value));
      else if(action==="target")E.targetRecruit(state,Number(button.dataset.id));
      else if(action==="prediction")globalThis.EkidenPrediction.place(state,marketTeam,marketRank,marketStake);
      else if(action==="lineup")E.setLineup(state,E.LEGS.map((_,i)=>Number(document.getElementById("leg-"+i).value)));
      else if(action==="start")E.startRace(state);
      else if(action==="next")E.stepRace(state,document.getElementById("strategy").value,Number(document.getElementById("water").value));
      else if(action==="skip")E.nextLeg(state,document.getElementById("strategy").value,Number(document.getElementById("water").value));
      else if(action==="close")E.closeYear(state);
    });
  });
  document.addEventListener("change",event=>{
    if(event.target.id==="market-team"){marketTeam=event.target.value;render();return;}
    if(event.target.id==="market-rank"){marketRank=Number(event.target.value);render();return;}
    if(event.target.id==="market-stake"){marketStake=Number(event.target.value);render();return;}
    if(event.target.id!=="savefile")return;
    const file=event.target.files[0];if(!file)return;
    file.text().then(text=>{if(text.length>8*1024*1024)throw Error("セーブファイルが大きすぎます");const imported=E.migrateSave(JSON.parse(text));state=imported;recoveryBlocked=false;corruptRaw=null;flash="セーブデータを読み込みました。";persist();render();}).catch(e=>{flash="読込失敗："+e.message;render()});
  });
  // Persist new-career seed before a language-only change.
  persist();render();
})();
