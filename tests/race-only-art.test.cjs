"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const script=fs.readFileSync("src/ekiden-tabs.js","utf8"),css=fs.readFileSync("src/ekiden-context.css","utf8"),html=fs.readFileSync("index.html","utf8");
test("run imagery only during actual simulated checkpoint race, not practice",()=>{
 assert.match(script,/const raceLive=kind==="race"&&!!panel\.querySelector/);
 assert.match(script,/\[data-action="next"\]/);
 assert.match(script,/raceLive\?"running":raceFinished\?"finished":"waiting"/);
 assert.match(css,/data-context="running"\] \.ekiden-art-runner\{display:block/);
 for(const kind of ["training","team","management","guide","waiting","finished"])
  assert.match(css,new RegExp('data-context="'+kind+'"\\] \\.ekiden-art-runner'));
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(html,/src\/ekiden-context\.css/);
 assert.doesNotMatch(script,/localStorage|s\.roster\s*=|s\.cash\s*=/);
 assert.doesNotThrow(()=>new vm.Script(script));
});
