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
  let state=load(), flash="";
  function load(){try{const raw=localStorage.getItem(KEY);if(raw){const s=JSON.parse(raw);E.validate(s);return s;}}catch(e){console.warn("セーブデータの読み込みに失敗:",e.message)}return E.newGame()}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){flash="自動保存できませんでした。下の「セーブ書き出し」を使用してください。";}}
  function panel(title,sub,body){return '<section class="panel"><header class="panelhead"><h2>'+title+'</h2><span class="tiny muted">'+sub+'</span></header><div class="panelbody">'+body+'</div></section>'}
  function statsCards(){
    const avg=Math.round(state.roster.reduce((a,b)=>a+average(b),0)/state.roster.length);
    const amount=state.race?("第"+Math.min(5,state.race.leg+1)+"区"):(state.week>=12?"大会直前":"練習中");
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
    const d=state.roster.map(r=>'<tr><td><strong>'+esc(r.name)+'</strong><div class="mini muted">'+r.grade+'年生'+(r.grade===4?'・最終学年':'')+'</div></td>'+E.SKILLS.map(k=>'<td class="num">'+dec(r.stats[k])+'</td>').join("")+'<td><div class="bar"><div class="fill '+(r.fatigue>=55?'warn':'')+'" style="width:'+Math.round(r.fatigue)+'%"></div></div><span class="mini muted">'+Math.round(r.fatigue)+'/100</span></td><td class="num">'+Math.round(r.morale)+'</td></tr>').join("");
    return panel("選手名鑑","卒業・新入部員あり",'<div class="tablewrap"><table><thead><tr><th>選手</th>'+E.SKILLS.map(k=>'<th class="num">'+skillLabels[k]+'</th>').join("")+'<th>疲労</th><th class="num">士気</th></tr></thead><tbody>'+d+'</tbody></table></div><p class="muted tiny">能力が高くても、当日の調子や終盤の粘り次第で結果は変わります。</p>')
  }
  function lineup(){
    const rows=E.LEGS.map((leg,i)=>'<div class="line"><div style="min-width:120px"><strong>'+leg.title+'</strong><div class="tiny muted">'+leg.km+'km</div></div><div class="field"><label for="leg-'+i+'">出走選手</label><select id="leg-'+i+'" '+(state.race?"disabled":"")+'>'+state.roster.map(r=>'<option value="'+r.id+'" '+(state.lineup[i]===r.id?"selected":"")+'>'+esc(r.name)+'（'+r.grade+'年・総合'+average(r)+'）</option>').join("")+'</select></div></div>').join("");
    return panel("区間配置","5区間 / 合計50km",rows+'<div style="margin-top:12px"><button class="btn secondary" data-action="lineup" '+(state.race?"disabled":"")+'>区間配置を確定</button></div>')
  }
  function store(){
    const shop=Object.entries(E.SHOP).map(([key,item])=>'<div class="shopcard"><div><strong>'+esc(item.name)+'</strong><p>'+esc(item.desc)+'</p>'+(state.items[key]?'<span class="pill">保有 '+state.items[key]+'個</span>':'')+'</div><button class="btn small secondary" data-action="buy" data-key="'+key+'" '+((state.race||state.week>=12||state.cash<item.cost)?"disabled":"")+'>'+yen(item.cost)+'</button></div>').join("");
    return panel("部費で購入する支援・備品","魔法アイテムなし",'<p class="tiny muted">支援効果はゲーム用に誇張していますが、合宿・測定・補給・装備など実在する活動に費用を割り当てています。購入費は全額その年度に記帳します。</p>'+shop)
  }
  function standing(){
    if(!state.race)return "";
    const race=state.race,sorted=race.contestants;
    return '<div class="track">'+E.LEGS.map((leg,i)=>'<div class="seg '+(i<race.leg?"done":i===race.leg?"now":"")+'">'+(i+1)+'区<small>'+leg.km+'km</small></div>').join("")+'</div>'+
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
    const choice=r.finished?'<div class="notice"><strong>'+r.rank+'位でゴール！</strong><br>'+(r.rank===1?'全国優勝です！強豪校の連覇を阻止しました。':'大学の年間記録を確認し、翌シーズンで挑みましょう。')+'</div><button class="btn" data-action="close">年度決算を確定して次年度へ →</button>':'<div class="controlrow"><div class="field"><label for="strategy">次区間の指示</label><select id="strategy"><option value="save">体力温存</option><option value="steady" selected>標準ペース</option><option value="push">積極策・攻め</option></select></div><button class="btn" data-action="next">次の区間を走る →</button></div><p class="muted tiny">「攻め」は体力があると速く、持久力が不足すると大幅に失速します。</p>';
    return panel("全国大学駅伝","レース進行中",info+standing()+'<div class="divider"></div>'+choice)
  }
  function finance(){
    const f=E.financials(state),entries=[...f.entries].reverse();
    return panel("年度決算・資金繰り",state.year+"年度 / 現金主義",'<div class="account"><div><label>収入</label><strong class="green">'+yen(f.income)+'</strong></div><div><label>支出</label><strong class="red">'+yen(f.expenses)+'</strong></div><div><label>収支</label><strong>'+yen(f.net)+'</strong></div></div><div class="line tiny"><span class="muted">期首残高</span><strong>'+yen(f.opening)+'</strong></div><div class="line tiny"><span class="muted">期末予測残高（現在）</span><strong>'+yen(f.ending)+'</strong></div><details class="collapse"><summary class="tiny">収支明細を開く（'+entries.length+'件）</summary><div class="ledger"><table><thead><tr><th>週</th><th>費目</th><th>内容</th><th class="num">収支</th></tr></thead><tbody>'+entries.map(x=>'<tr><td>'+x.week+'</td><td>'+esc(x.kind)+'</td><td>'+esc(x.label)+'</td><td class="num '+(x.amount>=0?"green":"red")+'">'+(x.amount>=0?"+":"")+yen(x.amount)+'</td></tr>').join("")+'</tbody></table></div></details><p class="muted mini">大学配分・卒業生支援は架空のモデル額です。寄付は賞金ではなく活動支援として計上。赤字取引は禁止し、残高は年度をまたいで繰り越します。</p>')
  }
  function history(){
    if(!state.history.length)return panel("歴代成績","周回するほど強くなる","<p class='muted tiny'>シーズン終了後、最終順位と年度決算がここに残ります。4年生は卒業し、新入部員が加入します。</p>");
    const rows=[...state.history].reverse().map(h=>'<tr><td>'+h.year+'年目</td><td class="num '+(h.rank===1?"green":"")+'">'+h.rank+'位</td><td>'+esc(h.winner)+'</td><td class="num">'+yen(h.finance.income)+'</td><td class="num">'+yen(h.finance.expenses)+'</td><td class="num">'+yen(h.finance.net)+'</td><td class="num">'+yen(h.finance.ending)+'</td></tr>').join("");
    const reports=[...state.history].reverse().map(h=>{const f=E.financials(state,h.year);return '<details class="collapse"><summary class="tiny">'+h.year+'年目の決算明細（'+f.entries.length+'件）</summary><div class="ledger"><table><thead><tr><th>週</th><th>費目</th><th>内容</th><th class="num">金額</th></tr></thead><tbody>'+f.entries.map(x=>'<tr><td>'+x.week+'</td><td>'+esc(x.kind)+'</td><td>'+esc(x.label)+'</td><td class="num">'+yen(x.amount)+'</td></tr>').join("")+'</tbody></table></div></details>'}).join("");
    return panel("歴代成績・年度決算","全年度の明細を保存",'<div class="tablewrap"><table><thead><tr><th>年</th><th class="num">順位</th><th>優勝校</th><th class="num">収入</th><th class="num">支出</th><th class="num">収支</th><th class="num">期末残高</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+reports);
  }
  function render(){
    const root=document.getElementById("app");
    root.innerHTML='<div class="wrap"><header class="top"><div><div class="eyebrow">University long-distance strategy</div><h1 class="brand">EKIDEN <span class="accent">MANAGER</span></h1><div class="sub">栄光への襷 — 育成 × レース戦術 × 部費経営</div></div><span class="tag">OFFLINE ALPHA v0.1</span></header>'+
      statsCards()+'<div class="notice">'+esc(flash||state.lastLog)+'</div><div class="layout"><div>'+
      racing()+training()+lineup()+runners()+'</div><aside>'+finance()+store()+history()+'</aside></div>'+
      '<footer class="footer"><div>ゲームの選手・大学・財務は架空設定です。結果は乱数シードで再現可能です。</div><div class="flex"><button class="btn small ghost" data-action="export">セーブ書き出し</button><button class="btn small ghost" data-action="import">セーブ読込</button><button class="btn small danger" data-action="reset">最初から</button><input type="file" id="savefile" accept=".json,application/json" hidden/></div></footer></div>';
  }
  function execute(fn){flash="";try{fn();E.validate(state);persist();}catch(e){flash="操作できませんでした："+e.message;}render();}
  function exportSave(){const data=JSON.stringify(state,null,2),blob=new Blob([data],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="ekiden-manager-year-"+state.year+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  document.addEventListener("click",event=>{
    const button=event.target.closest("[data-action]");if(!button||button.disabled)return;
    const action=button.dataset.action;
    if(action==="export"){exportSave();return;}
    if(action==="import"){document.getElementById("savefile").click();return;}
    if(action==="reset"){if(confirm("今の進行状況を消し、初年度から始めますか？ セーブ書き出しを推奨します。")){state=E.newGame();persist();render();}return;}
    execute(()=>{
      if(action==="train")E.train(state,document.getElementById("focus").value,document.getElementById("intensity").value);
      else if(action==="buy")E.buyItem(state,button.dataset.key);
      else if(action==="lineup")E.setLineup(state,E.LEGS.map((_,i)=>Number(document.getElementById("leg-"+i).value)));
      else if(action==="start")E.startRace(state);
      else if(action==="next")E.nextLeg(state,document.getElementById("strategy").value);
      else if(action==="close")E.closeYear(state);
    });
  });
  document.addEventListener("change",event=>{
    if(event.target.id!=="savefile")return;
    const file=event.target.files[0];if(!file)return;
    file.text().then(text=>{const imported=JSON.parse(text);E.validate(imported);state=imported;flash="セーブデータを読み込みました。";persist();render();}).catch(e=>{flash="読込失敗："+e.message;render()});
  });
  render();
})();
