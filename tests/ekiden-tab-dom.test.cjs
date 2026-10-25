"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs");
const source=fs.readFileSync("src/ekiden-tabs.js","utf8");
const keys=["race","training","team","management","guide"];
function make(tag){
 return {tagName:tag.toUpperCase(),dataset:{},attrs:{},children:[],hidden:false,textContent:"",handlers:{},
 setAttribute(k,v){this.attrs[k]=v;},append(x){this.children.push(x);},
 addEventListener(k,fn){this.handlers[k]=fn;},focus(){this.focused=true;},querySelector(){return null;},
 querySelectorAll(q){return q==="[data-ekiden-tab]"?this.children:[]}};
}
function fixture(){
 const panels=keys.map(k=>{const e=make("section");e.dataset.ekidenScreen=k;return e;});
 const wrap=make("div"),orientation=make("div");let nav=null;orientation.after=e=>{nav=e;};
 wrap.querySelector=q=>q==="#ekidenNav"?nav:q===".coach-orientation"?orientation:null;
 const root=make("main");
 root.querySelector=q=>q===".wrap"?wrap:q==='[data-ekiden-screen="race"]'?panels[0]:
   q.includes("data-ekiden-tab")?nav?.children.find(e=>q.includes('"'+e.dataset.ekidenTab+'"')):null;
 root.querySelectorAll=q=>q==="[data-ekiden-screen]"?panels:[];
 const document={getElementById:id=>id==="app"?root:null,createElement:make};
 class MutationObserver{constructor(cb){this.cb=cb;}observe(){}}
 const window={};vm.runInNewContext(source,{document,window,MutationObserver},{timeout:1000});
 return {window,root,panels,nav};
}
test("first-time EKIDEN coach sees training and all five tabs are connected to their actual panels",()=>{
 const {window,nav,panels}=fixture();
 assert.equal(window.EkidenScreens.current(),"training");
 assert.equal(nav.children.length,5);
 assert.deepEqual(panels.filter(p=>!p.hidden).map(p=>p.dataset.ekidenScreen),["training"]);
 for(const p of panels){
  assert.equal(p.attrs.role,"tabpanel");
  assert.equal(p.attrs["aria-labelledby"],"ekiden-tab-"+p.dataset.ekidenScreen);
 }
 for(const b of nav.children){
  assert.equal(b.attrs["aria-controls"],"ekiden-panel-"+b.dataset.ekidenTab+"-"+keys.indexOf(b.dataset.ekidenTab));
 }
});
test("selecting management and keyboard ArrowUp reveals team panel and retains correct focus",()=>{
 const {window,root,nav,panels}=fixture();
 assert.equal(window.EkidenScreens.choose("management"),true);
 assert.deepEqual(panels.filter(p=>!p.hidden).map(p=>p.dataset.ekidenScreen),["management"]);
 assert.equal(nav.children.filter(b=>b.attrs["aria-selected"]==="true")[0].dataset.ekidenTab,"management");
 const focused=nav.children.find(b=>b.dataset.ekidenTab==="management");
 root.handlers.keydown({target:{closest:()=>focused},key:"ArrowUp",preventDefault(){}});
 assert.equal(window.EkidenScreens.current(),"team");
 assert.equal(nav.children.find(b=>b.dataset.ekidenTab==="team").focused,true);
 assert.equal(window.EkidenScreens.choose("imaginary"),false);
 assert.equal(window.EkidenScreens.current(),"team");
});
