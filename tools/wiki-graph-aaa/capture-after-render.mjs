#!/usr/bin/env node
/**
 * Wiki-Graph AAA — "after" screenshots (render fix-wave + motion/chrome parity).
 *
 * Reuses the shared harness (harness.html / harness-bundle.mjs, built by
 * harness.mjs) but writes distinct `after-*.png` files instead of the
 * shared `before-*.png` baselines, so it can be re-run without clobbering
 * other agents' baseline captures.
 *
 * ROUND 4 fix: after three consecutive critic rounds naming
 * shots/after-physics.png as a stale/duplicate placeholder (byte-identical
 * copy of after-render.png, never regenerated), this script now captures a
 * DEDICATED after-physics.png every run — settled, no selection/hover/focus,
 * at the plain default `fit()` zoom (the "what most users see first" view
 * the critic specifically asked for, not a zoomed crop) — instead of copying
 * another piece's screenshot. There is no more copy-fallback for
 * after-physics.png or after-perf.png: after-perf.png is now produced by its
 * own dedicated script, tools/wiki-graph-aaa/measure-raf.mjs (real measured
 * RAF/settle numbers, not a placeholder image).
 *
 * Motion is owned by tools/wiki-graph-aaa/capture-motion.mjs (ROUND 6):
 * select()-pan strip + DETAIL_PANEL_OFFSET_X proof. Do NOT overwrite
 * after-motion.png here (same rule as after-chrome.png / capture-chrome-react).
 *
 * Usage: node tools/wiki-graph-aaa/capture-after-render.mjs
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.WIKI_GRAPH_HARNESS_PORT || 4178);
const HOST = "127.0.0.1";
const SHOTS = path.join(__dirname, "shots");

// Rebuild the bundle every run (unless --skip-bundle) — this harness embeds the
// real GraphEngine via esbuild, so an "after" capture against a stale bundle
// would silently keep showing pre-fix behaviour. Mirrors harness.mjs's bundle().
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

async function shot(page, name) {
  await mkdir(SHOTS, { recursive: true });
  const target = path.join(SHOTS, name);
  await page.locator("#harness-root").screenshot({ path: target, type: "png" });
  console.log(`shot ${name}`);
}

async function main() {
  if (!process.argv.includes("--skip-bundle")) {
    await bundle();
  }
  const server = await startStaticServer();
  const base = `http://${HOST}:${PORT}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

  try {
    await page.goto(`${base}/harness.html`, { waitUntil: "networkidle" });
    await waitReady(page);

    // 1) Settled full graph, undimmed — community hulls, edge-kind hierarchy,
    // glassy node fills, all visible at once (no focus dim active).
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(false);
      h.setBadge("after · render (settled)");
      h.select(null);
      h.setHover(null);
      h.fit();
      await h.settle(1100);
    });
    await shot(page, "after-render.png");

    // 1b) Dedicated physics shot (ROUND 4 fix): fresh every run, settled, no
    // selection/hover/focus, at the plain default fit() zoom — the exact
    // "constellation separation" view the critic asked to re-verify, not a
    // copy of the render shot above and not a zoomed-in crop.
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(false);
      h.setBadge("after · physics");
      h.select(null);
      h.setHover(null);
      h.fit();
      await h.settle(1100);
    });
    await shot(page, "after-physics.png");

    // 2) Obsidian-style focus/dim: hover a hub — neighborhood glows, rest dims
    // deeply, bloom on the hovered node, soft neighbor rings.
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(false);
      h.setBadge("after · render (focus/dim)");
      h.select(null);
      h.fit();
      h.setHover(h.hubId());
      for (let i = 0; i < 40; i++) {
        h.engine.wake();
        await new Promise((r) => requestAnimationFrame(r));
      }
    });
    await shot(page, "after-render-focus.png");

    // 3) Zoomed-in crop on a hub cluster — edge-kind styling (dashed
    // hierarchy, glowing relation, plain wiki) and label-halo quality at
    // readable scale. NB: `h.settle()` calls `engine.fit(false)` internally
    // (undoes manual zoom), so wait out the camera tween by hand instead.
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(false);
      h.setBadge("after · render (edge kinds, zoomed)");
      h.setHover(null);
      h.select(h.hubId());
      // Let the pan-to-selection camera tween finish before zooming, so the
      // zoom is centered on the hub instead of the previous viewport.
      for (let i = 0; i < 30; i++) {
        h.engine.wake();
        await new Promise((r) => requestAnimationFrame(r));
      }
      h.zoomBy(2.6);
      for (let i = 0; i < 30; i++) {
        h.engine.wake();
        await new Promise((r) => requestAnimationFrame(r));
      }
    });
    await shot(page, "after-render-edges.png");

    // Motion: capture-motion.mjs owns after-motion*.png (do not overwrite).
    // Chrome: capture-chrome-react.mjs owns after-chrome.png (do not overwrite).
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
