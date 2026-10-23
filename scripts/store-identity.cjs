"use strict";
// Canonical Store identity comes from ../store/partner-center-identity.json.
// Environment variables are confirmations only; they never override the canonical values.
const record = require("../store/partner-center-identity.json");

function issues(env, { required = true } = {}) {
  const errors = [];
  const recordFields = [
    ["productTitle", record.productTitle],
    ["storeId", record.storeId],
    ["identityName", record.identityName],
    ["publisher", record.publisher],
    ["publisherDisplayName", record.publisherDisplayName],
    ["storeDisplayName", record.storeDisplayName],
    ["packageFamilyName", record.packageFamilyName]
  ];
  for (const [key, value] of recordFields) {
    if (typeof value !== "string" || value.trim() === "") {
      errors.push("store/partner-center-identity.json の " + key + " が未設定です");
    }
  }

  const fields = [
    ["STORE_ID", "storeId"],
    ["STORE_IDENTITY_NAME", "identityName"],
    ["STORE_PUBLISHER", "publisher"],
    ["STORE_PUBLISHER_DISPLAY_NAME", "publisherDisplayName"],
    ["STORE_DISPLAY_NAME", "storeDisplayName"]
  ];
  for (const [variable, key] of fields) {
    const supplied = env[variable];
    if (typeof supplied !== "string" || supplied.trim() === "") {
      if (required) errors.push(variable + " を正本JSONと照合できる値で設定してください");
      continue;
    }
    if (supplied !== record[key]) {
      errors.push(variable + " が store/partner-center-identity.json と完全一致しません");
    }
  }

  if (typeof record.identityName === "string" &&
      typeof record.packageFamilyName === "string" &&
      !record.packageFamilyName.startsWith(record.identityName + "_")) {
    errors.push("Package Family Name が Identity Name と整合しません");
  }
  if (record.partnerCenterStatus !== "In draft") {
    errors.push("Partner Center状態の履歴値が想定外です。正本JSONを確認してください");
  }
  if (record.storeSubmission !== "HOLD") {
    errors.push("Store提出ゲートがHOLDではありません。所有者の承認履歴を確認してください");
  }
  if (record.packageSid !== null && (typeof record.packageSid !== "string" || record.packageSid.trim() === "")) {
    errors.push("packageSid は有効な値または null にしてください。推測値は禁止です");
  }
  return errors;
}

if (require.main === module) {
  const errs = issues(process.env);
  if (errs.length) {
    process.stderr.write("IDENTITY_HOLD\n" + errs.map(x => "- " + x).join("\n") + "\n");
    process.exitCode = 2;
  } else {
    process.stdout.write(
      "STORE_IDENTITY_MATCH — 環境の確認値とリポジトリ正本が一致しました。これはPartner Centerのライブ再確認ではありません。MSIX生成・WACK・実機試験・提出は未実施です。\n"
    );
  }
}
module.exports = { record, issues };
