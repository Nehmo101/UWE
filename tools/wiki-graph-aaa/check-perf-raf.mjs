#!/usr/bin/env node
/**
 * Wiki-Graph AAA — CI assertion on shots/after-perf-raf.json ceilings.
 *
 * Round 9: keep idle sleep + mount→idle product numbers honest in CI without
 * re-running Playwright every unit-test pass. Re-measure via measure-raf.mjs
 * when physics/RAF changes; this script only gates the committed JSON.
 *
 * Ceilings:
 *   idleRafPerSec === 0
 *   mountToIdleMs < 1500  (Round 10 — honest mount→idle without settle pad)
 *
 * Usage: node tools/wiki-graph-aaa/check-perf-raf.mjs
 * Exit 0 on pass, 1 on fail.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(__dirname, "shots", "after-perf-raf.json");

const MAX_MOUNT_TO_IDLE_MS = 1500;

const raw = await readFile(JSON_PATH, "utf8");
const data = JSON.parse(raw);

const idle = data.idleRafPerSec;
const mount = data.mountToIdleMs;

const errors = [];
if (idle !== 0) {
  errors.push(`idleRafPerSec must be === 0 (got ${idle})`);
}
if (typeof mount !== "number" || !(mount < MAX_MOUNT_TO_IDLE_MS)) {
  errors.push(`mountToIdleMs must be < ${MAX_MOUNT_TO_IDLE_MS} (got ${mount})`);
}

if (errors.length) {
  console.error(`check-perf-raf FAILED (${path.relative(process.cwd(), JSON_PATH)}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `check-perf-raf OK: idleRafPerSec=${idle}, mountToIdleMs=${mount} (< ${MAX_MOUNT_TO_IDLE_MS})`,
);
