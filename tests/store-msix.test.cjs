"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {gate,makeConfig,builderVersion,record}=require("../scripts/store-msix.cjs");
const pkg=require("../package.json");
const {issues}=require("../scripts/store-identity.cjs");
const env={STORE_IDENTITY_NAME:record.identityName,STORE_PUBLISHER:record.publisher,
 STORE_PUBLISHER_DISPLAY_NAME:record.publisherDisplayName,STORE_ID:record.storeId,
 STORE_IDENTITY_CONFIRMED:"YES",STORE_BRAND_APPROVED:"YES",STORE_PREDICTION_CONTENT_REVIEWED:"YES",STORE_PACKAGE_VERSION:"1.0.0.0"};
test("Store identity cannot be taken from another game",()=>{
 assert.deepEqual(issues(env),[]);
 assert.ok(issues({...env,STORE_IDENTITY_NAME:"OkinawaDesktopTools.20270FC9B0B9E"}).length);
 assert.ok(issues({...env,STORE_ID:"9NDJG4P8RW5F"}).length);
});
test("MSIX config targets exactly registered EKIDEN identity, not old portable installer",()=>{
 const conf=makeConfig(env);
 assert.equal(conf.msix.identityName,record.identityName);
 assert.equal(conf.msix.publisher,record.publisher);
 assert.equal(conf.msix.createMsixupload,true);
 assert.deepEqual(conf.win.target,[{target:"msix",arch:["x64"]}]);
 assert.deepEqual(conf.msix.capabilities,["runFullTrust"]);
 assert.equal(conf.directories.output,"dist-msix-store-candidate");
 assert.deepEqual(pkg.build.win.target.map(x=>x.target),["nsis","portable"]);
 assert.equal(builderVersion,"27.0.0-alpha.10");
});
test("preflight retains all safety blockers: release version, builder, identity, brand and Windows",()=>{
 const blocked=gate(env,{platform:"linux",installedBuilderVersion:"26.15.3"}).join("\n");
 assert.match(blocked,/Windows/);
 assert.match(blocked,/不一致/);
 assert.match(blocked,/electron-builder/);
 assert.match(blocked,/承認ロゴ/);
 assert.match(gate({...env,STORE_IDENTITY_NAME:"fake.name"},{platform:"win32",installedBuilderVersion:builderVersion}).join("\n"),/STORE_IDENTITY_NAME/);
 assert.match(gate({...env,STORE_BRAND_APPROVED:"NO"},{platform:"win32",installedBuilderVersion:builderVersion}).join("\n"),/STORE_BRAND_APPROVED/);
 assert.match(gate({...env,STORE_PREDICTION_CONTENT_REVIEWED:"NO"},{platform:"win32",installedBuilderVersion:builderVersion}).join("\n"),/STORE_PREDICTION_CONTENT_REVIEWED/);
});
test("PowerShell verifier checks manifest Name, Publisher, Version and SHA256",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const content=fs.readFileSync(path.join(__dirname,"../scripts/verify-store-msix.ps1"),"utf8");
 for(const token of ["AppxManifest.xml","identityName","publisher","STORE_PACKAGE_VERSION","SHA256"])
 assert.ok(content.includes(token),token);
});
