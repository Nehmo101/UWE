#!/usr/bin/env node
/**
 * Build uwe-release.json for GitHub Releases (Windows Command Center + UWE tag).
 *
 * Usage:
 *   node scripts/build-uwe-release-manifest.mjs \
 *     --version 0.1.0 \
 *     --tag uwe-v0.1.0 \
 *     --sha abcdef \
 *     --nsis path/to/setup.exe \
 *     --msi path/to/app.msi \
 *     --out uwe-release.json
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

const argv = process.argv.slice(2);
const version = argValue(argv, "--version");
const tag = argValue(argv, "--tag") || (version ? `uwe-v${version}` : undefined);
const sha = argValue(argv, "--sha") || process.env.GITHUB_SHA || "";
const nsis = argValue(argv, "--nsis");
const msi = argValue(argv, "--msi");
const out = argValue(argv, "--out") || "uwe-release.json";
const notes = argValue(argv, "--notes") || "";

if (!version || !tag) {
  console.error("Usage: build-uwe-release-manifest.mjs --version X.Y.Z [--tag uwe-vX.Y.Z] ...");
  process.exit(1);
}

function basenameOrNull(value) {
  if (!value) return null;
  return path.basename(value);
}

/**
 * SHA-256 of an installer, so the update flow can verify integrity independently
 * of GitHub HTTPS. A path that is provided but missing fails the build rather
 * than silently publishing a manifest with no checksum.
 */
function sha256OrNull(value) {
  if (!value) return null;
  if (!fs.existsSync(value)) {
    console.error(`Installer not found for checksum: ${value}`);
    process.exit(1);
  }
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex");
}

const manifest = {
  schemaVersion: 1,
  product: "uwe",
  version,
  tag,
  gitSha: sha,
  commandCenterVersion: version,
  publishedAt: new Date().toISOString(),
  notes,
  windows: {
    nsis: basenameOrNull(nsis),
    msi: basenameOrNull(msi),
    nsisSha256: sha256OrNull(nsis),
    msiSha256: sha256OrNull(msi),
  },
};

fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${out}`);
