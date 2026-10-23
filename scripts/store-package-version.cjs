"use strict";

// Store package version and internal package.json SemVer are separate version domains.
// This project emits a Windows Desktop MSIX for Store submission. Store builds use a
// four-part numeric Identity.Version. Under the selected Windows 10/11 Store package
// policy, Major must be non-zero, every part is 0..65535, and Revision is 0 at build time.

const STORE_VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const INTERNAL_SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function validateStorePackageVersion(value) {
  if (typeof value !== "string" || !STORE_VERSION_PATTERN.test(value)) {
    return ["STORE_PACKAGE_VERSION は Major.Minor.Build.Revision の4要素・10進数形式で指定してください（例示値を正式版として自動採用しません）"];
  }
  const parts = value.split(".").map(Number);
  const errors = [];
  parts.forEach((part, index) => {
    if (!Number.isInteger(part) || part < 0 || part > 65535) {
      errors.push("STORE_PACKAGE_VERSION の第" + (index + 1) + "要素は0～65535の整数である必要があります");
    }
  });
  if (parts[0] === 0) {
    errors.push("このStore向けWindowsパッケージ方式ではMajorを0にできません");
  }
  if (parts[3] !== 0) {
    errors.push("Store提出用パッケージのRevision（第4要素）はビルド時に0にしてください");
  }
  return errors;
}

function validateInternalSemVer(value) {
  if (typeof value !== "string" || !INTERNAL_SEMVER_PATTERN.test(value)) {
    return ["package.json.version は通常の3要素SemVer（必要に応じてprerelease/build metadata付き）である必要があります"];
  }
  return [];
}

module.exports = {
  STORE_VERSION_PATTERN,
  INTERNAL_SEMVER_PATTERN,
  validateStorePackageVersion,
  validateInternalSemVer
};
