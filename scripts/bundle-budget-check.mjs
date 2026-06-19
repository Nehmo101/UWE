/**
 * Bundle size budget check — runs after `pnpm build:release`.
 * Validates Next.js static chunk sizes for Studio (no browser required).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const studioNextDir = path.join(root, "apps/studio/.next");
const staticChunksDir = path.join(studioNextDir, "static/chunks");

/** Kilobytes — adjust with justification in docs/engineering/performance.md */
export const BUNDLE_BUDGETS_KB = {
  /** Sum of all client JS chunks */
  totalStaticChunksKb: 6_500,
  /** Largest single chunk (edit page editor bundle) */
  largestChunkKb: 550,
  /** Shared framework chunk (Next.js ~185 KB) */
  sharedChunkKb: 200,
};

function fail(message) {
  console.error(`bundle-budget-check: ${message}`);
  process.exit(1);
}

function listJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".js")) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results;
}

if (!fs.existsSync(studioNextDir)) {
  fail("apps/studio/.next not found — run pnpm build:release first");
}

const chunkFiles = listJsFiles(staticChunksDir);
if (chunkFiles.length === 0) {
  fail("no static chunks found under apps/studio/.next/static/chunks");
}

const sizesKb = chunkFiles.map((file) => ({
  file: path.relative(root, file),
  kb: fs.statSync(file).size / 1024,
}));

const totalKb = sizesKb.reduce((sum, entry) => sum + entry.kb, 0);
const largest = sizesKb.reduce((max, entry) => (entry.kb > max.kb ? entry : max), sizesKb[0]);

if (totalKb > BUNDLE_BUDGETS_KB.totalStaticChunksKb) {
  fail(
    `total static chunks ${totalKb.toFixed(0)} KB > ${BUNDLE_BUDGETS_KB.totalStaticChunksKb} KB`,
  );
}

if (largest.kb > BUNDLE_BUDGETS_KB.largestChunkKb) {
  fail(
    `largest chunk ${largest.file} ${largest.kb.toFixed(0)} KB > ${BUNDLE_BUDGETS_KB.largestChunkKb} KB`,
  );
}

const sharedCandidates = sizesKb.filter((entry) => /framework|main-app|webpack/.test(entry.file));
for (const shared of sharedCandidates) {
  if (shared.kb > BUNDLE_BUDGETS_KB.sharedChunkKb) {
    fail(
      `shared chunk ${shared.file} ${shared.kb.toFixed(0)} KB > ${BUNDLE_BUDGETS_KB.sharedChunkKb} KB`,
    );
  }
}

console.log(
  `bundle-budget-check: OK — ${chunkFiles.length} chunks, total ${totalKb.toFixed(0)} KB, largest ${largest.kb.toFixed(0)} KB (${largest.file})`,
);
