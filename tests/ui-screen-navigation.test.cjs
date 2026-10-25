"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8"),ui=fs.readFileSync("src/app.js","utf8"),tabs=fs.readFileSync("src/ekiden-tabs.js","utf8");
test("race tabs are wired after original game and reuse existing controls",()=>{
 assert.match(html,/src\/ekiden-tabs\.js/);
 assert.ok(html.indexOf("src/app.js")<html.indexOf("src/ekiden-tabs.js"));
 for(const name of ["race","training","team","management","guide"])
  assert.match(tabs,new RegExp('\\["'+name+'","'));
 assert.match(ui,/data-ekiden-screen/);
 for(const action of ["start","next","skip","train"])
  assert.match(ui,new RegExp('data-action=\\\\\\"'+action));
});
test("tab rendering does not write to game state or save storage",()=>{
 assert.doesNotMatch(tabs,/localStorage|\.cash\s*=|\.roster\s*=|\.race\s*=/);
 assert.match(tabs,/MutationObserver\(sync\)/);
 assert.match(tabs,/aria-selected/);
 assert.match(tabs,/setAttribute\("role","tabpanel"\)/);
 assert.match(tabs,/setAttribute\("aria-labelledby","ekiden-tab-"/);
 assert.match(tabs,/setAttribute\("aria-controls"/);
 assert.match(tabs,/ArrowUp/);
 assert.match(tabs,/ArrowDown/);
 assert.doesNotThrow(()=>new vm.Script(tabs));
 assert.doesNotThrow(()=>new vm.Script(ui));
});
