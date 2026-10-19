"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const src=fs.readFileSync("src/ekiden-tabs.js","utf8");
test("season close and paid joint practice return to training while live racing stays in race",()=>{
 assert.match(src,/if\(\["start","next","skip"\]\.includes\(op\)\)selected="race"/);
 assert.match(src,/if\(op==="train"\|\|op==="joint-practice"\|\|op==="close"\)selected="training"/);
 assert.match(src,/const raceLive=kind==="race"&&!!panel\.querySelector\('\[data-action="next"\]'\)/);
 assert.match(src,/raceLive\?"running":raceFinished\?"finished":"waiting"/);
 assert.doesNotThrow(()=>new vm.Script(src));
});
test("navigation is display only: game roster, cash and local save are not mutated",()=>{
 assert.doesNotMatch(src,/localStorage|sessionStorage|state\.cash\s*=|state\.roster\s*=|\.race\s*=/);
 assert.match(src,/panel\.hidden=!visible/);
 assert.match(src,/data\.raceTab=selected/);
});
