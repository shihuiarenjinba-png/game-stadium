"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { gate, makeConfig, builderVersion, record } = require("../scripts/store-msix.cjs");
const { validateStorePackageVersion, validateInternalSemVer } = require("../scripts/store-package-version.cjs");
const { rewriteManifest } = require("../scripts/store-msix-manifest-hook.cjs");
const pkg = require("../package.json");
const { issues } = require("../scripts/store-identity.cjs");

const env = {
  STORE_ID: record.storeId,
  STORE_IDENTITY_NAME: record.identityName,
  STORE_PUBLISHER: record.publisher,
  STORE_PUBLISHER_DISPLAY_NAME: record.publisherDisplayName,
  STORE_DISPLAY_NAME: record.storeDisplayName,
  SOURCE_GIT_COMMIT: "0123456789abcdef0123456789abcdef01234567",
  STORE_IDENTITY_CONFIRMED: "YES",
  STORE_BRAND_APPROVED: "YES",
  STORE_PREDICTION_CONTENT_REVIEWED: "YES",
  STORE_PACKAGE_VERSION_APPROVED: "YES",
  STORE_PACKAGE_VERSION: "1.0.0.0"
};

test("identity confirmations cannot point at a different Store product", () => {
  assert.deepEqual(issues(env), []);
  assert.ok(issues({ ...env, STORE_IDENTITY_NAME: "OkinawaDesktopTools.20270FC9B0B9E" }).length);
  assert.ok(issues({ ...env, STORE_ID: "9NDJG4P8RW5F" }).length);
});

test("MSIX config reads Name, Publisher, and PublisherDisplayName only from the canonical identity JSON", () => {
  const config = makeConfig(env);
  assert.equal(config.msix.identityName, record.identityName);
  assert.equal(config.msix.publisher, record.publisher);
  assert.equal(config.msix.publisherDisplayName, record.publisherDisplayName);
  assert.equal(config.msix.displayName, record.storeDisplayName);
  assert.deepEqual(config.extraResources, [{ from: "build/store-build-meta/SOURCE_GIT_COMMIT.txt", to: "SOURCE_GIT_COMMIT.txt" }]);
  assert.equal(config.appxManifestCreated, "./scripts/store-msix-manifest-hook.cjs");
  assert.equal(Object.prototype.hasOwnProperty.call(config, "buildVersion"), false);
  assert.deepEqual(config.win.target, [{ target: "msix", arch: ["x64"] }]);
  assert.equal(config.msix.createMsixupload, true);
  assert.equal(config.directories.output, "dist-msix-store-candidate");
  assert.deepEqual(pkg.build.win.target.map(x => x.target), ["nsis", "portable"]);
  assert.equal(pkg.version, "0.7.0");
  assert.equal(builderVersion, "27.0.0-alpha.10");
});

test("Store package version accepts canonical 4-part values within the component range", () => {
  assert.deepEqual(validateStorePackageVersion("1.0.0.0"), []);
  assert.deepEqual(validateStorePackageVersion("65535.65535.65535.0"), []);
});

test("Store package version rejects malformed, zero-Major, overflow, leading-zero and nonzero-Revision values", () => {
  for (const value of [
    "", "1.0.0", "1.0.0.0.0", "0.7.0.0", "01.0.0.0",
    "1.65536.0.0", "1.0.65536.0", "1.0.0.65536", "1.0.0.1",
    "-1.0.0.0", "1.0.0.x"
  ]) {
    assert.ok(validateStorePackageVersion(value).length > 0, "should reject " + value);
  }
});

test("internal package.json SemVer remains independent of the Store Identity.Version", () => {
  assert.equal(pkg.version, "0.7.0");
  assert.deepEqual(validateInternalSemVer("0.7.0"), []);
  assert.deepEqual(validateInternalSemVer("1.2.3-rc.1+build.7"), []);
  assert.ok(validateInternalSemVer("01.2.3").length > 0);
  assert.ok(validateInternalSemVer("0.7").length > 0);
  const errors = gate(env, { platform: "win32", installedBuilderVersion: builderVersion });
  assert.equal(errors.some(error => /package\.json\.version.*一致/.test(error)), false);
});

test("unapproved or invalid Store package versions fail closed", () => {
  assert.ok(gate({ ...env, STORE_PACKAGE_VERSION_APPROVED: "NO" },
    { platform: "win32", installedBuilderVersion: builderVersion }).some(x => x.includes("STORE_PACKAGE_VERSION_APPROVED")));
  assert.ok(gate({ ...env, STORE_PACKAGE_VERSION: "0.7.0.0" },
    { platform: "win32", installedBuilderVersion: builderVersion }).some(x => x.includes("Major")));
  assert.ok(gate({ ...env, STORE_PACKAGE_VERSION: "1.0.0.1" },
    { platform: "win32", installedBuilderVersion: builderVersion }).some(x => x.includes("Revision")));
});

test("preflight preserves OS, builder dependency, source and logo blockers", () => {
  const blocked = gate(env, { platform: "linux", installedBuilderVersion: "26.15.3" }).join("\n");
  assert.match(blocked, /Windows/);
  assert.match(blocked, /electron-builder/);
  // Review-only logos are generated before npm test in the Windows candidate CI.
  // Missing artwork must still fail closed on fresh unprepared checkouts.
  const prepared = ["StoreLogo.png","Square44x44Logo.png","Square150x150Logo.png","Wide310x150Logo.png"]
    .every(file => fs.existsSync(path.join(__dirname,"..","build","appx",file)));
  if(prepared) assert.doesNotMatch(blocked,/承認ロゴが未配置/);
  else assert.match(blocked,/承認ロゴが未配置/);
  assert.match(gate({ ...env, STORE_IDENTITY_NAME: "fake.name" },
    { platform: "win32", installedBuilderVersion: builderVersion }).join("\n"), /STORE_IDENTITY_NAME/);
  assert.match(gate({ ...env, STORE_BRAND_APPROVED: "NO" },
    { platform: "win32", installedBuilderVersion: builderVersion }).join("\n"), /STORE_BRAND_APPROVED/);
  assert.match(gate({ ...env, STORE_PREDICTION_CONTENT_REVIEWED: "NO" },
    { platform: "win32", installedBuilderVersion: builderVersion }).join("\n"), /STORE_PREDICTION_CONTENT_REVIEWED/);
});

test("Manifest hook changes only Identity.Version and checks the three canonical identity values", () => {
  const original = '<?xml version="1.0"?><Package><Identity Name="' + record.identityName +
    '" Publisher="' + record.publisher + '" Version="0.7.0.0" ProcessorArchitecture="x64"/>' +
    '<Properties><DisplayName>' + record.storeDisplayName + '</DisplayName><PublisherDisplayName>' +
    record.publisherDisplayName + '</PublisherDisplayName></Properties><Applications><Application><VisualElements DisplayName="' + record.storeDisplayName + '"/></Application></Applications></Package>';
  const updated = rewriteManifest(original, "1.0.0.0");
  assert.ok(updated.includes('Version="1.0.0.0"'));
  assert.ok(updated.includes('Name="' + record.identityName + '"'));
  assert.ok(updated.includes('Publisher="' + record.publisher + '"'));
  assert.ok(updated.includes("<PublisherDisplayName>" + record.publisherDisplayName + "</PublisherDisplayName>"));
  assert.equal(updated.replace('Version="1.0.0.0"', 'Version="0.7.0.0"'), original);
  assert.throws(() => rewriteManifest(original.replace(record.identityName, "OkinawaDesktopTools.WRONG"), "1.0.0.0"), /Identity\.Name/);
  assert.throws(() => rewriteManifest(original.replace(record.publisher, "CN=Wrong"), "1.0.0.0"), /Identity\.Publisher/);
  assert.throws(() => rewriteManifest(original.replace(record.publisherDisplayName, "Wrong publisher"), "1.0.0.0"), /PublisherDisplayName/);
  assert.throws(() => rewriteManifest(original.replace("<DisplayName>" + record.storeDisplayName + "</DisplayName>", "<DisplayName>Wrong title</DisplayName>"), "1.0.0.0"), /DisplayName/);
  assert.throws(() => rewriteManifest(original, "0.7.0.0"), /Major/);
});

test("candidate mode permits only an unsigned internal package without claiming commercial approvals", () => {
  const candidateEnv = { ...env, STORE_BUILD_MODE: "CANDIDATE",
    STORE_IDENTITY_CONFIRMED: "OWNER_APPROVED",
    STORE_BRAND_APPROVED: "CANDIDATE_ONLY",
    STORE_PREDICTION_CONTENT_REVIEWED: "CANDIDATE_ONLY",
    STORE_PACKAGE_VERSION_APPROVED: "CANDIDATE_ONLY" };
  const candidateIssues=gate(candidateEnv,{platform:"win32",installedBuilderVersion:builderVersion});
  const artIsReady=["StoreLogo.png","Square44x44Logo.png","Square150x150Logo.png","Wide310x150Logo.png"]
    .every(file=>fs.existsSync(path.join(__dirname,"..","build","appx",file)));
  // On source-only Linux runners the review artwork has not yet been generated;
  // that must remain a real packaging blocker, not a test failure.
  if(artIsReady)assert.deepEqual(candidateIssues,[]);
  else{
    assert.ok(candidateIssues.length>=4);
    assert.ok(candidateIssues.every(x=>/承認ロゴが未配置/.test(x)),candidateIssues.join("\n"));
  }
  const formal = gate({ ...candidateEnv, STORE_BUILD_MODE: undefined },
    { platform: "win32", installedBuilderVersion: builderVersion }).join("\n");
  assert.match(formal, /STORE_IDENTITY_CONFIRMED/);
  assert.match(formal, /STORE_BRAND_APPROVED/);
  assert.match(formal, /STORE_PREDICTION_CONTENT_REVIEWED/);
  assert.match(formal, /STORE_PACKAGE_VERSION_APPROVED/);
});

test("Store icon candidate script creates required dimensions deterministically without overwriting existing artwork", () => {
  const icons = require("../scripts/make-store-candidate-icons.cjs");
  assert.deepEqual(icons.specs, {
    "StoreLogo.png": [50, 50], "Square44x44Logo.png": [44, 44],
    "Square150x150Logo.png": [150, 150], "Wide310x150Logo.png": [310, 150]
  });
  for (const [name, [w,h]] of Object.entries(icons.specs)) {
    const png = icons.paint(w,h);
    assert.equal(png.subarray(0,8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), w);
    assert.equal(png.readUInt32BE(20), h);
    assert.ok(png.equals(icons.paint(w,h)), name + " must be deterministic");
  }
});

test("PowerShell verifier checks Name, Publisher, PublisherDisplayName, Version rules, Architecture and SHA256", () => {
  const content = fs.readFileSync(path.join(__dirname, "../scripts/verify-store-msix.ps1"), "utf8");
  for (const token of [
    "AppxManifest.xml", "identityName", "publisher", "publisherDisplayName",
    "STORE_PACKAGE_VERSION", "ProcessorArchitecture", "SHA256", "SOURCE_GIT_COMMIT", "ja-JP", "en-US"
  ]) assert.ok(content.includes(token), token);
});

test("PowerShell verifier parses successfully on Windows",()=>{
 if(process.platform!=="win32")return;
 const {spawnSync}=require("node:child_process");
 const file=path.join(__dirname,"../scripts/verify-store-msix.ps1");
 const command="$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile('"+file.replace(/'/g,"''")+"',[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){$errors|ForEach-Object{Write-Error $_};exit 1}";
 const r=spawnSync("powershell.exe",["-NoProfile","-Command",command],{encoding:"utf8"});
 assert.equal(r.status,0,(r.stderr||r.stdout||"PowerShell parser failed"));
});
