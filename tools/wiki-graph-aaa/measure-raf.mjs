#!/usr/bin/env node
/**
 * Wiki-Graph AAA — perf evidence (Round 4).
 *
 * Round 3 found and fixed the actual idle-sleep bug (loop() rescheduled the
 * next requestAnimationFrame BEFORE checking `awake`, so the computed rest
 * state was structurally unreachable) and backed it with deterministic
 * mockRaf() unit tests — but three consecutive rounds of critic notes flagged
 * that the fix had ZERO real-browser, user-facing evidence: no CPU trace, no
 * RAF-callback count, no chart. This script closes that gap directly against
 * a REAL Chromium page (via Playwright, same harness every other capture
 * script here uses) instead of a mocked RAF queue:
 *
 *   1. Settle the graph fully (same as the other captures' `h.settle()`).
 *   2. Wrap the page's OWN `window.requestAnimationFrame` to count calls
 *      (forwarding to the real one — this does not change scheduling, only
 *      observes it) and measure how many callbacks fire over a real 1-second
 *      window while genuinely idle. If the Round 3 fix holds, this should be
 *      ~0 (no timer left running at rest).
 *   3. Trigger a real interaction (hover a hub — the same focus/dim
 *      highlight-lerp transition `capture-after-render.mjs` exercises) and
 *      measure real wall-clock time from the trigger to the last RAF
 *      callback the page actually issues, i.e. how long the loop stays
 *      "awake" before it stops itself again.
 *
 * Writes:
 *   shots/after-perf-raf.json   { idleRafPerSec, settleMs, nodeCount }
 *   shots/after-perf.png        real settled-graph screenshot + a text
 *                                overlay stating the measured numbers (no
 *                                chart library needed, no copy-fallback).
 *
 * Usage: node tools/wiki-graph-aaa/measure-raf.mjs
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.WIKI_GRAPH_HARNESS_PORT || 4180);
const HOST = "127.0.0.1";
const SHOTS = path.join(__dirname, "shots");

const IDLE_WINDOW_MS = 1000; // real wall-clock window for the "at rest" RAF count
const WAKE_SETTLE_MAX_MS = 5000; // upper bound to wait for the loop to re-stop after an interaction
// Simulated-annealing note: ALPHA_DECAY (graph-engine-physics.ts) × steps
// until ALPHA_MIN=0.02 from alpha=1. ROUND 6: 0.99→0.985 (~389→~259 steps).
// ROUND 7: 0.985→0.978 (~172 steps) + sync prewarm early-exit when already
// at REST — mount→idle should no longer need the full RAF annealing tail.
// ROUND 10: larger sync prewarm budget finishes cooling before first paint;
// measure mount→idle WITHOUT the harness settle(1100) wake (that padded the
// Round 7–9 number by a full second). Cap remains for loaded headless Chromium.
const TRUE_IDLE_TIMEOUT_MS = 20_000;

async function bundle() {
  const entry = path.join(__dirname, "harness-entry.ts");
  const outfile = path.join(__dirname, "harness-bundle.mjs");
  const graphTypes = path.join(ROOT, "packages/database/src/graph-types.ts");
  const bin = path.join(
    ROOT,
    "node_modules",
    ".pnpm",
    "esbuild@0.28.1",
    "node_modules",
    "esbuild",
    "bin",
    "esbuild",
  );
  await stat(bin);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        bin,
        entry,
        "--bundle",
        "--format=esm",
        "--platform=browser",
        "--target=es2022",
        `--outfile=${outfile}`,
        `--alias:@uwe/database/graph-types=${graphTypes}`,
        "--log-level=warning",
      ],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  if (result.code !== 0) {
    throw new Error(`esbuild failed (${result.code}):\n${result.stderr || result.stdout}`);
  }
  if (result.stderr.trim()) console.log(result.stderr.trim());
  console.log(`bundled → ${path.relative(ROOT, outfile)}`);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

function startStaticServer() {
  const root = __dirname;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
      const filePath = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
      if (!filePath.startsWith(root)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      const data = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(data);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, () => resolve(server));
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => document.documentElement.dataset.harnessReady === "1", null, { timeout: 30_000 });
  await page.waitForFunction(() => Boolean(window.__WIKI_GRAPH_HARNESS__?.ready), null, { timeout: 30_000 });
}

/**
 * Wraps `window.requestAnimationFrame` to count/timestamp every call while
 * still forwarding to the real one — a pure observer, not a scheduler
 * change. Installed AFTER the graph has already settled once so the wrapper
 * only ever sees calls this measurement itself is interested in.
 */
async function installRafCounter(page) {
  await page.evaluate(() => {
    window.__rafLog = [];
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      window.__rafLog.push(performance.now());
      return orig(cb);
    };
  });
}

/**
 * Polls the engine's OWN `awake` flag (same private field the loop itself
 * checks — `engine["raf"]`/`engine["awake"]` bracket-access is exactly what
 * this package's own graph-engine.test.ts mockRaf tests use) instead of a
 * fixed wall-clock guess, so "idle" means the loop has actually decided to
 * stop, not just "probably long enough".
 */
async function waitForTrueIdle(page, timeoutMs = TRUE_IDLE_TIMEOUT_MS) {
  const start = Date.now();
  try {
    await page.waitForFunction(
      () => window.__WIKI_GRAPH_HARNESS__.engine["awake"] === false,
      null,
      { timeout: timeoutMs, polling: 50 },
    );
    return { idle: true, waitedMs: Date.now() - start };
  } catch {
    return { idle: false, waitedMs: Date.now() - start };
  }
}

async function measureIdleRaf(page) {
  await page.evaluate(() => {
    window.__rafLog = [];
  });
  await page.waitForTimeout(IDLE_WINDOW_MS);
  const count = await page.evaluate(() => window.__rafLog.length);
  return count / (IDLE_WINDOW_MS / 1000);
}

async function measureWakeSettle(page) {
  await page.evaluate(() => {
    window.__rafLog = [];
  });
  const triggerMs = await page.evaluate(() => {
    const h = window.__WIKI_GRAPH_HARNESS__;
    h.setBadge("after · perf (wake → settle)");
    const t = performance.now();
    // Same focus/dim highlight-lerp transition capture-after-render.mjs uses
    // for after-render-focus.png — a real, bounded animation (HL_LERP decay
    // toward target, graph-engine.ts) rather than a synthetic one.
    h.setHover(h.hubId());
    return t;
  });
  const idled = await waitForTrueIdle(page, WAKE_SETTLE_MAX_MS);
  if (!idled.idle) {
    console.warn(
      `wake → settle did not reach true idle within ${WAKE_SETTLE_MAX_MS}ms — reporting the RAF-log tail anyway`,
    );
  }
  const lastMs = await page.evaluate(() => {
    const log = window.__rafLog;
    return log.length ? log[log.length - 1] : null;
  });
  // Clear the hover again so the harness returns to a clean, undimmed state
  // for the background screenshot below.
  await page.evaluate(async () => {
    const h = window.__WIKI_GRAPH_HARNESS__;
    h.setHover(null);
    h.select(null);
    await h.settle(300);
  });
  if (lastMs == null) return 0;
  return Math.max(0, lastMs - triggerMs);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
}

async function buildPerfReportHtml(bgBase64, metrics) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  #stage {
    position: relative;
    width: 1280px;
    height: 800px;
    background: #f4ecda url(data:image/png;base64,${bgBase64}) no-repeat center / cover;
    font-family: "Segoe UI", "IBM Plex Sans", system-ui, sans-serif;
    color: #211d17;
  }
  .card {
    position: absolute;
    right: 24px;
    top: 24px;
    width: 340px;
    background: rgba(255, 253, 247, 0.94);
    border: 1px solid rgba(28, 24, 20, 0.16);
    border-radius: 14px;
    padding: 16px 18px;
    box-shadow: 0 12px 32px rgba(28, 24, 20, 0.16);
  }
  .badge {
    display: inline-block;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #5c5346;
    background: rgba(28, 24, 20, 0.08);
    border-radius: 999px;
    padding: 3px 9px;
    margin-bottom: 10px;
  }
  .row { display: flex; justify-content: space-between; align-items: baseline; margin: 9px 0; }
  .row .label { font-size: 11.5px; color: #5c5346; }
  .row .value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .row .unit { font-size: 11px; color: #5c5346; margin-left: 4px; font-weight: 400; }
  .note { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(28, 24, 20, 0.14); font-size: 10.5px; color: #5c5346; line-height: 1.4; }
</style>
</head>
<body>
  <div id="stage">
    <div class="card">
      <span class="badge">after &middot; perf (measured, real Chromium)</span>
      <div class="row"><span class="label">Idle RAF callbacks</span><span class="value">${escapeHtml(metrics.idleRafPerSec.toFixed(2))}<span class="unit">/s</span></span></div>
      <div class="row"><span class="label">Wake &rarr; settle</span><span class="value">${escapeHtml(metrics.settleMs.toFixed(0))}<span class="unit">ms</span></span></div>
      <div class="row"><span class="label">Mount &rarr; idle</span><span class="value">${escapeHtml(Number(metrics.mountToIdleMs || 0).toFixed(0))}<span class="unit">ms</span></span></div>
      <div class="row"><span class="label">Node count</span><span class="value">${escapeHtml(String(metrics.nodeCount))}</span></div>
      <div class="note">requestAnimationFrame calls counted on the real page over a 1s idle window (should be ~0 once the layout is at rest); wake→settle is hover focus/dim; mount→idle is wall-clock to engine.awake===false (annealing).</div>
    </div>
  </div>
</body>
</html>
`;
  const target = path.join(__dirname, "perf-report.generated.html");
  await writeFile(target, html, "utf8");
  return target;
}

async function main() {
  if (!process.argv.includes("--skip-bundle")) {
    await bundle();
  }
  const server = await startStaticServer();
  const base = `http://${HOST}:${PORT}`;
  const browser = await chromium.launch({ headless: true });

  let idleRafPerSec = 0;
  let settleMs = 0;
  let mountToIdleMs = 0;
  let nodeCount = 0;

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const mountStart = Date.now();
    await page.goto(`${base}/harness.html`, { waitUntil: "networkidle" });
    await waitReady(page);

    nodeCount = await page.evaluate(() => window.__WIKI_GRAPH_HARNESS__.fixture.nodes.length);

    // ROUND 10: product mount→idle = navigation → engine.awake===false.
    // Do NOT call h.settle()/fit()/select here — those wake the loop and
    // historically padded the metric by ≥1100ms of artificial wait.
    await page.evaluate(() => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(false);
      h.setBadge("after · perf (mount → idle)");
    });
    const annealIdle = await waitForTrueIdle(page);
    mountToIdleMs = Date.now() - mountStart;
    console.log(
      `reached true idle (engine.awake === false): ${annealIdle.idle} after ${annealIdle.waitedMs}ms post-ready; mount→idle wall=${mountToIdleMs}ms`,
    );

    await installRafCounter(page);

    idleRafPerSec = await measureIdleRaf(page);
    console.log(`idle RAF callbacks: ${idleRafPerSec.toFixed(2)}/s (measured over ${IDLE_WINDOW_MS}ms real time)`);

    settleMs = await measureWakeSettle(page);
    console.log(`wake → settle: ${settleMs.toFixed(0)}ms (hover-triggered focus/dim transition)`);

    // Clean settled full-graph shot for the report's background — fresh
    // render, taken after the measurements above (not a copy of any other
    // piece's shot).
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setBadge("after · perf");
      h.select(null);
      h.setHover(null);
      h.fit();
      await h.settle(500);
    });
    const bgBuffer = await page.locator("#harness-root").screenshot({ type: "png" });
    await page.close();

    const metrics = { idleRafPerSec, settleMs, mountToIdleMs, nodeCount };
    await mkdir(SHOTS, { recursive: true });
    const jsonTarget = path.join(SHOTS, "after-perf-raf.json");
    await writeFile(jsonTarget, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
    console.log(`wrote ${path.relative(ROOT, jsonTarget)}`);

    // Composite the measured numbers as a text overlay on top of the real
    // settled-graph screenshot, on the same server/browser — a fresh render
    // each run, no copy-fallback.
    const reportPage = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const htmlPath = await buildPerfReportHtml(bgBuffer.toString("base64"), metrics);
    await reportPage.goto(`${base}/${path.basename(htmlPath)}`, { waitUntil: "networkidle" });
    const target = path.join(SHOTS, "after-perf.png");
    await reportPage.locator("#stage").screenshot({ path: target, type: "png" });
    console.log(`shot after-perf.png (real measured numbers, fresh render)`);
    await reportPage.close();
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
