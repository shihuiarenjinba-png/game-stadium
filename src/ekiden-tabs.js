/* Rebuilds navigation after EKIDEN's own render; does not modify roster or race state. */
(() => {"use strict";
 const PAGES=[["race","🏃 レース"],["training","🏋️ 練習"],["team","👥 選手・編成"],
              ["management","💴 経営・記録"],["guide","📖 遊び方"]];
 const root=document.getElementById("app");if(!root)return;
 let selected="race";
 function sync(){
  const wrap=root.querySelector(".wrap");if(!wrap)return;
  const panels=Array.from(root.querySelectorAll("[data-ekiden-screen]"));
  if(!panels.length)return;
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
  if(adv&&selected==="management")adv.open=true;
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