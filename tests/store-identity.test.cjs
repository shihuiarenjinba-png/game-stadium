"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {record,issues}=require("../scripts/store-identity.cjs");
test("owner-confirmed Store draft is recorded, never marked published",()=>{
 assert.equal(record.partnerCenterStatus,"In draft");
 assert.equal(record.storeSubmission,"HOLD");
 assert.ok(/^9[A-Z0-9]{11}$/.test(record.storeId));
 assert.match(record.publisher,/^CN=46263F21-/);
});
test("correct identity passes and another game's name or publisher fails closed",()=>{
 const env={STORE_IDENTITY_NAME:record.identityName,STORE_PUBLISHER:record.publisher,STORE_PUBLISHER_DISPLAY_NAME:record.publisherDisplayName,STORE_ID:record.storeId};
 assert.deepEqual(issues(env),[]);
 assert.ok(issues({...env,STORE_IDENTITY_NAME:"OkinawaDesktopTools.WRONGAPP"}).some(x=>x.includes("STORE_IDENTITY_NAME")));
 assert.ok(issues({...env,STORE_PUBLISHER:"CN=Another"}).some(x=>x.includes("STORE_PUBLISHER")));
 assert.ok(issues({...env,STORE_ID:"9ZZZZZZZZZZZ"}).some(x=>x.includes("STORE_ID")));
 assert.ok(issues({}, {required:true}).length>=3);
});
