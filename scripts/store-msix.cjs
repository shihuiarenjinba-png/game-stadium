"use strict";
/* Separate Store MSIX candidate pipeline. Existing NSIS / portable packaging is unchanged. */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { record, issues: identityIssues } = require("./store-identity.cjs");
const { validateStorePackageVersion, validateInternalSemVer } = require("./store-package-version.cjs");

const root = path.resolve(__dirname, "..");
const LOGOS = Object.freeze({
  "StoreLogo.png": [50, 50],
  "Square150x150Logo.png": [150, 150],
  "Square44x44Logo.png": [44, 44],
  "Wide310x150Logo.png": [310, 150]
});
const requiredFiles = ["index.html", "src/engine.js", "src/app.js", "src/styles.css", "desktop/main.cjs"];
const builderVersion = "27.0.0-alpha.10";

function dimensions(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 33 ||
      bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      bytes.toString("ascii", 12, 16) !== "IHDR") return null;
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function gate(env, { platform = process.platform, rootDir = root, installedBuilderVersion = null } = {}) {
  const errors = identityIssues(env);
  const candidateBuild = env.STORE_BUILD_MODE === "CANDIDATE";
  if (platform !== "win32") errors.push("Store MSIX候補はWindowsのビルド環境で生成してください");
  const identityApproved = env.STORE_IDENTITY_CONFIRMED === "YES" ||
    (candidateBuild && env.STORE_IDENTITY_CONFIRMED === "OWNER_APPROVED");
  if (!identityApproved) {
    errors.push("STORE_IDENTITY_CONFIRMED=YES（正式ビルド）またはCANDIDATE限定のOWNER_APPROVED（記録値を使った未提出候補）が必要です");
  }
  if (env.STORE_BRAND_APPROVED !== "YES" && !candidateBuild) {
    errors.push("STORE_BRAND_APPROVED=YES（正式ビルド前に商用ロゴ・表示の承認）が必要です");
  }
  if (env.STORE_PREDICTION_CONTENT_REVIEWED !== "YES" && !candidateBuild) {
    errors.push("STORE_PREDICTION_CONTENT_REVIEWED=YES（正式ビルド前に順位予想・仮想払戻しの内容とIARC申告方針の確認）が必要です");
  }
  if (env.STORE_PACKAGE_VERSION_APPROVED !== "YES" && !candidateBuild) {
    errors.push("STORE_PACKAGE_VERSION_APPROVED=YES が必要です。正式版番号として採用する前に既受理版の有無と公開用版番号を所有者が明示承認してください");
  }

  const storeVersionErrors = validateStorePackageVersion(env.STORE_PACKAGE_VERSION);
  errors.push.apply(errors, storeVersionErrors);
  const sourceCommit = (env.SOURCE_GIT_COMMIT || env.GITHUB_SHA || "").trim();
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) {
    errors.push("SOURCE_GIT_COMMIT または GITHUB_SHA に40桁のSource commitが必要です");
  }

  let pkg = null;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  } catch (error) {
    errors.push("package.json を読み取れません: " + error.message);
  }
  if (pkg) {
    const internalVersionErrors = validateInternalSemVer(pkg.version);
    errors.push.apply(errors, internalVersionErrors);
    // Deliberately do not compare STORE_PACKAGE_VERSION to package.json.version + ".0".
    // The former is AppxManifest Identity.Version; the latter is internal app SemVer.
  }

  let actualBuilder = installedBuilderVersion;
  if (actualBuilder === null) {
    const builderPackagePath = path.join(rootDir, "node_modules", "electron-builder", "package.json");
    if (fs.existsSync(builderPackagePath)) {
      try {
        actualBuilder = JSON.parse(fs.readFileSync(builderPackagePath, "utf8")).version;
      } catch (error) {
        errors.push("インストール済みelectron-builderのバージョンを読み取れません: " + error.message);
      }
    }
  }
  if (actualBuilder !== builderVersion) {
    errors.push("Store MSIX検証用electron-builder " + builderVersion + " が必要です。現在の依存版を無断更新せず、Store用の独立したビルド環境を整えてください");
  }

  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(rootDir, file))) errors.push("アプリ原本が不足: " + file);
  }
  for (const [file, size] of Object.entries(LOGOS)) {
    const logoPath = path.join(rootDir, "build", "appx", file);
    if (!fs.existsSync(logoPath)) {
      errors.push("承認ロゴが未配置: " + file);
      continue;
    }
    try {
      const actual = dimensions(logoPath);
      if (!actual || actual[0] !== size[0] || actual[1] !== size[1]) {
        errors.push("承認ロゴのサイズが不正: " + file);
      }
    } catch (error) {
      errors.push("承認ロゴを読み取れません: " + file);
    }
  }
  return errors;
}

function makeConfig(env) {
  // Identity source: the existing JSON record. Environment values only confirm it via gate().
  // Store package version is applied to AppxManifest by appxManifestCreated, not buildVersion.
  return {
    appId: "jp.ekidenmanager.game",
    productName: "EKIDEN MANAGER",
    asar: true,
    files: ["index.html", "src/**/*.js", "src/**/*.css", "desktop/main.cjs", "package.json"],
    extraResources: [{ from: "build/store-build-meta/SOURCE_GIT_COMMIT.txt", to: "SOURCE_GIT_COMMIT.txt" }],
    directories: { output: "dist-msix-store-candidate", buildResources: "build" },
    toolsets: { winCodeSign: "1.1.0" },
    win: { target: [{ target: "msix", arch: ["x64"] }] },
    msix: {
      applicationId: "EkidenManager",
      identityName: record.identityName,
      publisher: record.publisher,
      publisherDisplayName: record.publisherDisplayName,
      displayName: record.storeDisplayName,
      languages: ["ja-JP", "en-US"],
      createMsixupload: true,
      setBuildNumber: false,
      capabilities: ["runFullTrust"]
    },
    appxManifestCreated: "./scripts/store-msix-manifest-hook.cjs"
  };
}

function run() {
  const errors = gate(process.env);
  if (errors.length) {
    process.stderr.write("STORE_MSIX_HOLD\n" + errors.map(error => "- " + error).join("\n") + "\n");
    process.exitCode = 2;
    return;
  }
  if (process.argv.includes("--preflight")) {
    process.stdout.write("STORE_MSIX_PREFLIGHT_PASS — 設定検査のみ。MSIX生成・WACK・実機検証・販売提出は未実施です。\n");
    return;
  }
  const outputDir = path.join(root, "dist-msix-store-candidate");
  if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).length) {
    process.stderr.write("出力先に既存成果物があります。上書きせず、別のクリーンな環境で検証してください。\n");
    process.exitCode = 2;
    return;
  }
  const configPath = path.join(root, "electron-builder.store.candidate.generated.json");
  if (fs.existsSync(configPath)) {
    process.stderr.write("既存のStore候補設定を保護しました。内容を別途確認してから続行してください。\n");
    process.exitCode = 2;
    return;
  }
  const sourceCommit = (process.env.SOURCE_GIT_COMMIT || process.env.GITHUB_SHA || "").trim();
  const metaDir = path.join(root, "build", "store-build-meta");
  const commitFile = path.join(metaDir, "SOURCE_GIT_COMMIT.txt");
  fs.mkdirSync(metaDir, { recursive: true });
  if (fs.existsSync(commitFile) && fs.readFileSync(commitFile, "utf8").trim() !== sourceCommit) {
    process.stderr.write("既存SOURCE_GIT_COMMIT.txtが現在のSource commitと不一致です。上書きせず停止します。\n");
    process.exitCode = 2;
    return;
  }
  fs.writeFileSync(commitFile, sourceCommit + "\n", "utf8");
  fs.writeFileSync(configPath, JSON.stringify(makeConfig(process.env), null, 2) + "\n", { flag: "wx" });
  const cli = path.join(root, "node_modules", "electron-builder", "cli.js");
  const result = spawnSync(process.execPath, [cli, "--win", "msix", "--x64", "--config", configPath, "--publish", "never"],
    { cwd: root, stdio: "inherit", shell: false });
  if (result.error || result.status !== 0) {
    process.stderr.write("MSIX生成が失敗しました。既存リリースや出力は上書きしていません。\n");
    process.exitCode = result.status || 1;
    return;
  }
  const verifier = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
    path.join(root, "scripts", "verify-store-msix.ps1")], { cwd: root, stdio: "inherit", shell: false, env: process.env });
  if (verifier.error || verifier.status !== 0) {
    process.stderr.write("MSIX Manifest照合HOLD\n");
    process.exitCode = verifier.status || 2;
    return;
  }
  process.stdout.write("MSIX検証候補を生成しManifest照合が成功しました。認定・実機動作・セーブ互換性・WACK・提出は引き続き別ゲートです。\n");
}

if (require.main === module) run();
module.exports = { gate, makeConfig, dimensions, requiredFiles, LOGOS, builderVersion, record };
