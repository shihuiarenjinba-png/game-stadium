"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { record, issues } = require("../scripts/store-identity.cjs");

test("record contains this product's canonical identity and remains a historical draft/HOLD record", () => {
  assert.equal(record.productTitle, "EKIDEN MANAGER");
  assert.equal(record.storeId, "9NL1HLJRFQ39");
  assert.equal(record.identityName, "OkinawaDesktopTools.EKIDENMANAGER");
  assert.equal(record.publisher, "CN=46263F21-A700-41DB-8C9B-114C22FB82FC");
  assert.equal(record.publisherDisplayName, "Okinawa Desktop Tools");
  assert.equal(record.storeDisplayName, "EKIDEN MANAGER");
  assert.equal(record.partnerCenterStatus, "In draft");
  assert.equal(record.partnerCenterStatusCurrent, false);
  assert.equal(record.partnerCenterStatusVerifiedAt, "2026-10-18");
  assert.equal(record.packageSid, null);
  assert.equal(record.storeSubmission, "HOLD");
  assert.equal(record.formalStoreMsix.path, null);
  assert.equal(record.formalStoreMsix.sha256, null);
});

test("all five supplied Store identity/display confirmations must exactly match the JSON source of truth", () => {
  const env = {
    STORE_ID: record.storeId,
    STORE_IDENTITY_NAME: record.identityName,
    STORE_PUBLISHER: record.publisher,
    STORE_PUBLISHER_DISPLAY_NAME: record.publisherDisplayName,
    STORE_DISPLAY_NAME: record.storeDisplayName
  };
  assert.deepEqual(issues(env), []);
  assert.ok(issues({ ...env, STORE_IDENTITY_NAME: "OkinawaDesktopTools.WRONGAPP" }).some(x => x.includes("STORE_IDENTITY_NAME")));
  assert.ok(issues({ ...env, STORE_PUBLISHER: "CN=Another" }).some(x => x.includes("STORE_PUBLISHER")));
  assert.ok(issues({ ...env, STORE_PUBLISHER_DISPLAY_NAME: "Wrong publisher" }).some(x => x.includes("STORE_PUBLISHER_DISPLAY_NAME")));
  assert.ok(issues({ ...env, STORE_DISPLAY_NAME: "Wrong title" }).some(x => x.includes("STORE_DISPLAY_NAME")));
  assert.ok(issues({ ...env, STORE_ID: "9NDJG4P8RW5F" }).some(x => x.includes("STORE_ID")));
  assert.ok(issues({}, { required: true }).length >= 5);
});

test("missing package SID stays null instead of accepting a guessed value", () => {
  assert.equal(record.packageSid, null);
  assert.match(record.packageSidStatus, /do not guess/i);
});
