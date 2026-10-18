/* Rebuilds navigation after EKIDEN's own render; does not modify roster or race state. */
(() => {"use strict";
 const PAGES=[["race","🏃 レース"],["training","🏋️ 練習"],["team","👥 選手・編成"],
              ["management","💴 経営・記録"],["guide","📖 遊び方"]];
 const root=document.getElementById("app");if(!root)return;
 let selected="race",initialViewDecided=false;
 function sync(){
  const wrap=root.querySelector(".wrap");if(!wrap)return;
  const panels=Array.from(root.querySelectorAll("[data-ekiden-screen]"));
  if(!panels.length)return;
  // First-time coaches should see weekly training, not an unopened race screen.
  // Later render calls retain the player's chosen tab.
  if(!initialViewDecided){
   initialViewDecided=true;
   const pendingTraining=root.querySelector('[data-ekiden-screen="race"]');
   const raceAvailable=!!pendingTraining?.querySelector('[data-action="start"],[data-action="next"],[data-action="skip"],[data-action="close"]');
   if(!raceAvailable&&panels.some(p=>p.dataset.ekidenScreen==="training"))selected="training";
  }
  // Contextual scenery is scoped to the real game screens, not drawn as one shared background.
  const seen=new Set();
  for(const panel of panels){
   const kind=panel.dataset.ekidenScreen;
   if(seen.has(kind))continue;seen.add(kind);
   const parent=panel.querySelector(".panelbody");if(!parent)continue;
   const raceLive=kind==="race"&&!!panel.querySelector('[data-action="next"]');
   const raceFinished=kind==="race"&&!!panel.querySelector(".finish-banner");
   const type=kind==="race"?(raceLive?"running":raceFinished?"finished":"waiting"):kind;
   const labels={
    running:["大会レース中","この画面のみ走者演出を表示。順位と区間の進行はゲーム内の記録を参照します。"],
    finished:["レース終了","走行演出を停止し、順位と年度結果を確認します。"],
    waiting:["大会スケジュール","大会前は走者を表示しません。練習と区間編成を進めてください。"],
    training:["練習場","週次練習と合同練習の調整。レース中の映像は表示しません。"],
    team:["選手と編成","選手の能力、疲労、区間配置の確認画面です。"],
    management:["チーム運営","部費・記録・必要な支援を確認します。"],
    guide:["監督手帳","競技ルールと操作説明のための画面です。"]
   };
   const [title,note]=labels[type]||labels.guide;
   let scene=parent.querySelector(".ekiden-context");
   if(!scene){
    scene=document.createElement("div");scene.className="ekiden-context";
    const art=document.createElement("div");art.className="ekiden-context-art";art.setAttribute("aria-hidden","true");
    for(const part of ["field","lane","building","prop","runner"]){
     const shape=document.createElement("span");shape.className="ekiden-art-"+part;art.append(shape);
    }
    const copy=document.createElement("div");copy.className="ekiden-context-copy";
    const h=document.createElement("strong");h.className="ekiden-context-title";
    const p=document.createElement("p");p.className="ekiden-context-note";
    copy.append(h,p);scene.append(art,copy);parent.insertBefore(scene,parent.firstChild);
   }
   scene.dataset.context=type;
   scene.querySelector(".ekiden-context-title").textContent=title;
   scene.querySelector(".ekiden-context-note").textContent=note;
  }
  let nav=wrap.querySelector("#ekidenNav");
  if(!nav){
   nav=document.createElement("nav");nav.id="ekidenNav";nav.className="ekiden-navigation";
   nav.setAttribute("role","tablist");nav.setAttribute("aria-label","監督メニュー");
   for(const [key,label] of PAGES){
    const button=document.createElement("button");button.type="button";button.dataset.ekidenTab=key;
    button.textContent=label;button.setAttribute("role","tab");nav.append(button);
   }
   const guide=wrap.querySelector(".coach-orientation");if(guide)guide.after(nav);
   else wrap.querySelector("header.top").after(nav);
  }
  for(const panel of panels){
   const visible=panel.dataset.ekidenScreen===selected;
   panel.hidden=!visible;panel.setAttribute("aria-hidden",String(!visible));
  }
  const adv=root.querySelector(".coach-advanced");
  if(adv){
   adv.hidden=selected!=="management";
   adv.setAttribute("aria-hidden",String(adv.hidden));
   if(!adv.hidden)adv.open=true;
  }
  for(const button of nav.querySelectorAll("[data-ekiden-tab]")){
   const active=button.dataset.ekidenTab===selected;button.setAttribute("aria-selected",String(active));
   button.tabIndex=active?0:-1;
  }
  const layout=root.querySelector(".layout");
  if(layout)layout.dataset.raceTab=selected;
 }
 function choose(value){
  if(!PAGES.some(([key])=>key===value))return false;
  selected=value;sync();return true;
 }
 root.addEventListener("click",event=>{
  const tab=event.target.closest("[data-ekiden-tab]");
  if(tab){choose(tab.dataset.ekidenTab);return;}
  const game=event.target.closest("[data-action]");
  if(!game)return;
  const op=game.dataset.action;
  if(["start","next","skip"].includes(op))selected="race";
  if(op==="train")selected="training";
 });
 root.addEventListener("keydown",event=>{
  const tab=event.target.closest("[data-ekiden-tab]");if(!tab)return;
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
  event.preventDefault();
  const index=PAGES.findIndex(([key])=>key===selected);
  const next=event.key==="Home"?0:event.key==="End"?PAGES.length-1:
   (index+(event.key==="ArrowLeft"?-1:1)+PAGES.length)%PAGES.length;
  choose(PAGES[next][0]);
  root.querySelector('[data-ekiden-tab="'+selected+'"]')?.focus();
 });
 const observer=new MutationObserver(sync);
 observer.observe(root,{childList:true});
 window.EkidenScreens=Object.freeze({choose,current:()=>selected});
 sync();
})();