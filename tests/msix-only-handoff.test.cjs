"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
const guard=fs.readFileSync("scripts/msix-only-guard.cjs","utf8");
const build=fs.readFileSync("scripts/store-msix.cjs","utf8");
test("commercial build never uses the old NSIS or Portable EXE command",()=>{
 assert.equal(pkg.scripts["build:win"],"node scripts/msix-only-guard.cjs");
 assert.equal(pkg.scripts["build:msix"],"node scripts/store-msix.cjs");
 assert.match(guard,/exitCode\s*=\s*2/);
 assert.match(build,/target:"msix"/);
 assert.match(build,/verify-store-msix.ps1/);
});
test("store identity and rights preflight remain mandatory and do not claim certification",()=>{
 assert.match(build,/STORE_IDENTITY_CONFIRMED/);
 assert.match(build,/STORE_BRAND_APPROVED/);
 assert.match(build,/STORE_PREDICTION_CONTENT_REVIEWED/);
 assert.match(build,/WACK/);
 assert.doesNotMatch(build,/STORE_MSIX_PREFLIGHT_PASS[\s\S]*Certification PASS/i);
});