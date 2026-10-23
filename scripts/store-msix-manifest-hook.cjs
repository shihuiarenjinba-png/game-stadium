"use strict";
const fs = require("node:fs");
const { record } = require("./store-identity.cjs");
const { validateStorePackageVersion } = require("./store-package-version.cjs");

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (match, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&amp;/g, "&");
}

function getAttribute(tag, attributeName) {
  // Attribute names used here are fixed schema identifiers: Name, Publisher, Version.
  const expression = new RegExp("\\b" + attributeName + "\\s*=\\s*([\"'])(.*?)\\1", "g");
  const matches = Array.from(tag.matchAll(expression));
  if (matches.length !== 1) throw new Error("Manifest Identity attribute " + attributeName + " が1件ではありません");
  return decodeXml(matches[0][2]);
}

function rewriteManifest(manifestText, version, identityRecord = record) {
  const versionErrors = validateStorePackageVersion(version);
  if (versionErrors.length) throw new Error(versionErrors.join("; "));

  const identityTags = manifestText.match(/<Identity\b[^>]*>/g) || [];
  if (identityTags.length !== 1) throw new Error("AppxManifest.xml の Identity element が1件ではありません");
  const identityTag = identityTags[0];
  const name = getAttribute(identityTag, "Name");
  const publisher = getAttribute(identityTag, "Publisher");
  if (name !== identityRecord.identityName) {
    throw new Error("Manifest Identity.Name が store/partner-center-identity.json と一致しません");
  }
  if (publisher !== identityRecord.publisher) {
    throw new Error("Manifest Identity.Publisher が store/partner-center-identity.json と一致しません");
  }

  const publisherNames = Array.from(manifestText.matchAll(/<PublisherDisplayName\b[^>]*>([\s\S]*?)<\/PublisherDisplayName>/g));
  if (publisherNames.length !== 1) {
    throw new Error("Manifest Properties/PublisherDisplayName element が1件ではありません");
  }
  if (decodeXml(publisherNames[0][1].trim()) !== identityRecord.publisherDisplayName) {
    throw new Error("Manifest PublisherDisplayName が store/partner-center-identity.json と一致しません");
  }

  const properties = Array.from(manifestText.matchAll(/<Properties\b[^>]*>([\s\S]*?)<\/Properties>/g));
  if (properties.length !== 1) throw new Error("Manifest Properties element が1件ではありません");
  const displayNames = Array.from(properties[0][1].matchAll(/<DisplayName\b[^>]*>([\s\S]*?)<\/DisplayName>/g));
  if (displayNames.length !== 1 || decodeXml(displayNames[0][1].trim()) !== identityRecord.storeDisplayName) {
    throw new Error("Package/Properties/DisplayName が予約済みStore名と一致しません");
  }
  const visualElements = manifestText.match(/<(?:[A-Za-z0-9_-]+:)?VisualElements\b[^>]*>/g) || [];
  if (visualElements.length !== 1 || getAttribute(visualElements[0], "DisplayName") !== identityRecord.storeDisplayName) {
    throw new Error("uap:VisualElements/@DisplayName が予約済みStore名と一致しません");
  }

  const versionAttribute = /\bVersion\s*=\s*(["'])(.*?)\1/g;
  const versionAttributes = Array.from(identityTag.matchAll(versionAttribute));
  if (versionAttributes.length !== 1) throw new Error("Identity.Version attribute が1件ではありません");
  const updatedIdentityTag = identityTag.replace(/\bVersion\s*=\s*(["'])(.*?)\1/, function (match, quote) {
    return "Version=" + quote + version + quote;
  });
  return manifestText.replace(identityTag, updatedIdentityTag);
}

exports.default = async function (manifestPath) {
  if (typeof manifestPath !== "string" || manifestPath.trim() === "") {
    throw new Error("electron-builder の appxManifestCreated hook にManifestパスが渡されませんでした");
  }
  const currentManifest = fs.readFileSync(manifestPath, "utf8");
  const updatedManifest = rewriteManifest(currentManifest, process.env.STORE_PACKAGE_VERSION, record);
  fs.writeFileSync(manifestPath, updatedManifest, "utf8");
};
exports.rewriteManifest = rewriteManifest;
exports.decodeXml = decodeXml;
