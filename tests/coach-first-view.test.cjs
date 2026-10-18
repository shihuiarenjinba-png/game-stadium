"use strict";const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const src=fs.readFileSync("src/ekiden-tabs.js","utf8");
test("first-time coach enters training, not unopened race; advanced finance stays inside management",()=>{
 assert.match(src,/initialViewDecided=false/);
 assert.match(src,/if\(!raceAvailable&&panels\.some\(p=>p\.dataset\.ekidenScreen==="training"\)\)selected="training"/);
 assert.match(src,/adv\.hidden=selected!=="management"/);
 assert.match(src,/adv\.setAttribute\("aria-hidden",String\(adv\.hidden\)\)/);
 assert.match(src,/MutationObserver\(sync\)/);
 assert.doesNotMatch(src,/localStorage|\.week\s*=|\.cash\s*=|\.race\s*=/);
 assert.doesNotThrow(()=>new vm.Script(src));
});