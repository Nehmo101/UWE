#!/usr/bin/env node
/**
 * Wiki-Graph AAA — motion evidence.
 *
 * ROUND 11 primary strip: select-pan CameraAnimator mid-tween at CAMERA_TWEEN_MS
 * (180ms, easeOutQuint — Obsidian-like 150–200ms band). Virtual timestamps via
 * performance.now() monkey-patch so Playwright screenshot latency cannot smear
 * the curve. Captures f1–f6 at t=0/36/72/108/144/180ms and stitches
 * after-motion-strip.png.
 *
 * Also proves:
 *   - DETAIL_PANEL_OFFSET_X via after-motion-offset.json (tweenMs=180)
 *   - after-motion-tween.json (snappiness samples; mid progress >0.9)
 *   - after-motion-wheel.json (continuous zoomBy cursor-lock still holds)
 *
 * Usage: node tools/wiki-graph-aaa/capture-motion.mjs
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.WIKI_GRAPH_HARNESS_PORT || 4179);
const HOST = "127.0.0.1";
const SHOTS = path.join(__dirname, "shots");

// Must match GraphView.tsx DETAIL_PANEL_OFFSET_X (half of w-[312px] panel).
const DETAIL_PANEL_OFFSET_X = 156;
const DETAIL_PANEL_WIDTH = 312;

const FRAME_COUNT = 6;
const CAMERA_TWEEN_MS = 180;
/** Per-frame zoom factor for secondary wheel cursor-lock proof. */
const WHEEL_ZOOM_FACTOR = 1.15;

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

/** Mock the GraphView detail panel so offset framing is visually legible. */
async function showMockDetailPanel(page, on) {
  await page.evaluate(
    ({ on, width }) => {
      const root = document.getElementById("harness-root");
      if (!root) return;
      let panel = document.getElementById("aaa-mock-detail-panel");
      if (!on) {
        panel?.remove();
        return;
      }
      if (!panel) {
        panel = document.createElement("aside");
        panel.id = "aaa-mock-detail-panel";
        panel.setAttribute("aria-hidden", "true");
        Object.assign(panel.style, {
          position: "absolute",
          top: "48px",
          right: "16px",
          bottom: "24px",
          width: `${width}px`,
          background: "rgba(255,253,247,0.92)",
          border: "1px solid rgba(28,24,20,0.16)",
          borderRadius: "12px",
          boxShadow: "0 12px 28px rgba(28,24,20,0.14)",
          zIndex: "40",
          padding: "14px 16px",
          fontFamily: '"Segoe UI","IBM Plex Sans",system-ui,sans-serif',
          color: "#211d17",
          pointerEvents: "none",
        });
        panel.innerHTML = `<div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#5c5346;margin-bottom:8px">Detail · mock</div>
          <div style="font-size:15px;font-weight:650;margin-bottom:6px">Selected node</div>
          <div style="font-size:11px;color:#5c5346;line-height:1.4">Camera target = viewport center − DETAIL_PANEL_OFFSET_X so the node sits in the open canvas, not under this panel.</div>`;
        root.appendChild(panel);
      }
    },
    { on, width: DETAIL_PANEL_WIDTH },
  );
}

/**
 * Settle fit view, prove DETAIL_PANEL_OFFSET_X at end-state, prime camFrom/camTo
 * for the mid-tween select-pan strip.
 */
async function proveOffsetAndPrimeSelectPan(page) {
  await page.evaluate(async (offsetX) => {
    const h = window.__WIKI_GRAPH_HARNESS__;
    h.setChromeVisible(false);
    h.select(null);
    h.setHover(null);
    h.setBadge("after · motion (pre-select)");
    h.fit();
    await h.settle(1100);
    h.engine.setFocusOffsetX(offsetX);
  }, DETAIL_PANEL_OFFSET_X);

  await showMockDetailPanel(page, true);

  const offsetProof = await page.evaluate((args) => {
    const { offsetX, tweenMs } = args;
    const h = window.__WIKI_GRAPH_HARNESS__;
    const hub = h.engine.map.get(h.hubId()) || h.engine.nodes[0];
    const rect = h.canvas.getBoundingClientRect();

    // Instant end-state framing for the offset JSON proof.
    h.engine.cameraAnim.cancel();
    h.engine["cancelWheelCoast"]?.();
    h.engine.selectedId = hub.id;
    hub.fixed = true;
    hub.vx = 0;
    hub.vy = 0;
    const cx = rect.width / 2 - offsetX;
    const cy = rect.height / 2;
    h.engine.tx = cx - hub.x * h.engine.zoom;
    h.engine.ty = cy - hub.y * h.engine.zoom;
    h.engine["render"]();

    const screenX = hub.x * h.engine.zoom + h.engine.tx;
    const screenY = hub.y * h.engine.zoom + h.engine.ty;
    const expectedX = rect.width / 2 - offsetX;
    const expectedY = rect.height / 2;
    const errX = Math.abs(screenX - expectedX);
    const errY = Math.abs(screenY - expectedY);

    window.__motionSelectId = hub.id;
    window.__camFrom = null;
    window.__camTo = null;

    return {
      detailPanelOffsetX: offsetX,
      zoom: h.engine.zoom,
      focusOffsetX: h.engine.focusOffsetX,
      selectedId: hub.id,
      screenX,
      screenY,
      expectedX,
      expectedY,
      errX,
      errY,
      ok: errX <= 2 && errY <= 2 && h.engine.focusOffsetX === offsetX,
      cameraTweenMs: tweenMs,
      cameraEase: "easeOutQuint",
      note: "Selected node screen position must equal viewport center minus DETAIL_PANEL_OFFSET_X (left of mock panel).",
    };
  }, { offsetX: DETAIL_PANEL_OFFSET_X, tweenMs: CAMERA_TWEEN_MS });

  await mkdir(SHOTS, { recursive: true });
  const proofPath = path.join(SHOTS, "after-motion-offset.json");
  await writeFile(proofPath, `${JSON.stringify(offsetProof, null, 2)}\n`, "utf8");
  console.log(
    `DETAIL_PANEL_OFFSET_X proof: ok=${offsetProof.ok} errX=${offsetProof.errX.toFixed(2)} errY=${offsetProof.errY.toFixed(2)} zoom=${offsetProof.zoom.toFixed(3)} → ${path.relative(ROOT, proofPath)}`,
  );
  if (!offsetProof.ok) {
    throw new Error(
      `DETAIL_PANEL_OFFSET_X framing failed: errX=${offsetProof.errX}, errY=${offsetProof.errY}, focusOffsetX=${offsetProof.focusOffsetX}`,
    );
  }
}

/**
 * Six mid-tween select-pan frames at virtual t=0…180ms (easeOutQuint).
 * Restarts the animator each sample so screenshot latency cannot drift time.
 */
async function captureSelectPanTweenStrip(page) {
  await page.evaluate((args) => {
    const { offsetX, tweenMs } = args;
    const h = window.__WIKI_GRAPH_HARNESS__;
    const hub = h.engine.map.get(window.__motionSelectId);
    const rect = h.canvas.getBoundingClientRect();

    // Start pose = whole-graph fit (hub NOT under offset target).
    h.engine.cameraAnim.cancel();
    h.engine["cancelWheelCoast"]?.();
    h.select(null);
    h.fit();
    const from = { tx: h.engine.tx, ty: h.engine.ty, zoom: h.engine.zoom };
    const cx = rect.width / 2 - offsetX;
    const cy = rect.height / 2;
    const to = {
      zoom: from.zoom,
      tx: cx - hub.x * from.zoom,
      ty: cy - hub.y * from.zoom,
    };
    window.__camFrom = from;
    window.__camTo = to;
    window.__tweenMs = tweenMs;
    h.engine.selectedId = hub.id;
    hub.fixed = true;
    h.engine.setFocusOffsetX(offsetX);
    h.setBadge("after · motion (SELECT PAN TWEEN · 180ms)");

    // Freeze performance.now for CameraAnimator.step().
    if (!window.__realPerfNow) {
      window.__realPerfNow = performance.now.bind(performance);
    }
    window.__fakeNow = 1000;
    performance.now = () => window.__fakeNow;
  }, { offsetX: DETAIL_PANEL_OFFSET_X, tweenMs: CAMERA_TWEEN_MS });

  const frames = [];
  const samples = [];

  for (let i = 0; i < FRAME_COUNT; i++) {
    const tMs = Math.round((i / (FRAME_COUNT - 1)) * CAMERA_TWEEN_MS);
    const sample = await page.evaluate((tMs) => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      const from = window.__camFrom;
      const to = window.__camTo;
      const dur = window.__tweenMs;
      window.__fakeNow = 1000;
      h.engine.cameraAnim.start(from, to, dur);
      window.__fakeNow = 1000 + tMs;
      const state = h.engine.cameraAnim.step();
      if (!state) throw new Error(`cameraAnim.step() null at t=${tMs}`);
      h.engine.tx = state.tx;
      h.engine.ty = state.ty;
      h.engine.zoom = state.zoom;
      h.engine["render"]();
      if (h.engine.mini) h.engine["renderMini"]();
      const progress =
        Math.abs(to.tx - from.tx) < 1e-9
          ? tMs >= dur
            ? 1
            : 0
          : (state.tx - from.tx) / (to.tx - from.tx);
      return {
        tMs,
        progress,
        tx: state.tx,
        ty: state.ty,
        zoom: state.zoom,
        animating: h.engine.cameraAnim.isAnimating(),
      };
    }, tMs);
    samples.push(sample);
    const name = `after-motion-f${i + 1}.png`;
    await shot(page, name);
    frames.push(name);
  }

  // Restore real clock; settle final frame for after-motion.png.
  await page.evaluate(() => {
    const h = window.__WIKI_GRAPH_HARNESS__;
    if (window.__realPerfNow) performance.now = window.__realPerfNow;
    const to = window.__camTo;
    h.engine.tx = to.tx;
    h.engine.ty = to.ty;
    h.engine.zoom = to.zoom;
    h.engine.cameraAnim.cancel();
    h.setBadge("after · motion (settled · select pan 180ms)");
    h.engine["render"]();
  });
  await shot(page, "after-motion.png");

  const mid = samples.find((s) => s.tMs === Math.round(CAMERA_TWEEN_MS / 2)) || samples[3];
  const tweenProof = {
    ok: true,
    cameraTweenMs: CAMERA_TWEEN_MS,
    cameraEase: "easeOutQuint",
    midTweenMs: mid.tMs,
    midProgress: mid.progress,
    midSnappy: mid.progress > 0.9,
    samples,
    note: "easeOutQuint mid-tween (t=0.5) must be >0.9; strip is select-pan, not wheel steps.",
  };
  if (!tweenProof.midSnappy) {
    throw new Error(
      `select-pan mid-tween not snappy: progress=${mid.progress} at t=${mid.tMs} (need >0.9)`,
    );
  }
  const tweenPath = path.join(SHOTS, "after-motion-tween.json");
  await writeFile(tweenPath, `${JSON.stringify(tweenProof, null, 2)}\n`, "utf8");
  console.log(
    `select-pan tween proof: tweenMs=${CAMERA_TWEEN_MS} midProgress=${mid.progress.toFixed(4)} → ${path.relative(ROOT, tweenPath)}`,
  );

  return frames;
}

/** Secondary: discrete zoomBy cursor-lock still holds (continuous product path). */
async function proveWheelCursorLock(page) {
  await page.evaluate(() => {
    const h = window.__WIKI_GRAPH_HARNESS__;
    const nd = h.engine.map.get(window.__motionSelectId);
    window.__wheelCx = nd.x * h.engine.zoom + h.engine.tx;
    window.__wheelCy = nd.y * h.engine.zoom + h.engine.ty;
    window.__wheelWorldX = nd.x;
    window.__wheelWorldY = nd.y;
  });

  const cursorProof = [];
  for (let i = 1; i <= FRAME_COUNT; i++) {
    if (i > 1) {
      await page.evaluate((factor) => {
        const h = window.__WIKI_GRAPH_HARNESS__;
        h.engine.zoomBy(factor, window.__wheelCx, window.__wheelCy);
      }, WHEEL_ZOOM_FACTOR);
    }
    const sample = await page.evaluate(() => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      const sx = window.__wheelWorldX * h.engine.zoom + h.engine.tx;
      const sy = window.__wheelWorldY * h.engine.zoom + h.engine.ty;
      return {
        zoom: h.engine.zoom,
        screenX: sx,
        screenY: sy,
        pivotX: window.__wheelCx,
        pivotY: window.__wheelCy,
        err: Math.hypot(sx - window.__wheelCx, sy - window.__wheelCy),
      };
    });
    cursorProof.push(sample);
    if (sample.err > 1.5) {
      throw new Error(
        `wheel zoom-around-cursor drift at step ${i}: err=${sample.err.toFixed(3)}`,
      );
    }
  }

  const zoomPath = path.join(SHOTS, "after-motion-wheel.json");
  await writeFile(
    zoomPath,
    `${JSON.stringify({ ok: true, factorPerStep: WHEEL_ZOOM_FACTOR, frames: cursorProof }, null, 2)}\n`,
    "utf8",
  );
  console.log(`wheel zoom-around-cursor proof → ${path.relative(ROOT, zoomPath)}`);
}

async function buildStripHtml(frameFiles) {
  const cellW = 300;
  const cellH = 188;
  const items = frameFiles
    .map((f, i) => {
      const tMs = Math.round((i / (FRAME_COUNT - 1)) * CAMERA_TWEEN_MS);
      return `<figure>
        <img src="/shots/${f}" width="${cellW}" height="${cellH}" alt="frame ${i + 1}" />
        <figcaption>f${i + 1} &middot; select pan &middot; ${tMs}ms</figcaption>
      </figure>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #f4ecda; font-family: "Segoe UI", "IBM Plex Sans", system-ui, sans-serif; }
  #strip { display: inline-flex; gap: 10px; padding: 16px; align-items: flex-start; }
  figure { margin: 0; background: #fffdf7; border: 1px solid rgba(28,24,20,0.14); border-radius: 8px; padding: 6px; }
  figure img { display: block; border-radius: 4px; width: ${cellW}px; height: ${cellH}px; object-fit: cover; }
  figcaption { text-align: center; font-size: 11px; color: #5c5346; margin-top: 4px; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
  <div id="strip">
${items}
  </div>
</body>
</html>
`;
  const target = path.join(__dirname, "motion-strip.generated.html");
  await writeFile(target, html, "utf8");
}

async function stitchStrip(browser, base, frameFiles) {
  await buildStripHtml(frameFiles);
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  try {
    await page.goto(`${base}/motion-strip.generated.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => {
        const imgs = Array.from(document.querySelectorAll("#strip img"));
        return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
      },
      null,
      { timeout: 15_000 },
    );
    const target = path.join(SHOTS, "after-motion-strip.png");
    await page.locator("#strip").screenshot({ path: target, type: "png" });
    console.log(`shot after-motion-strip.png (stitched ${frameFiles.length} select-pan frames @ ${CAMERA_TWEEN_MS}ms)`);
  } finally {
    await page.close();
  }
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
    await proveOffsetAndPrimeSelectPan(page);
    const frames = await captureSelectPanTweenStrip(page);
    await proveWheelCursorLock(page);
    await stitchStrip(browser, base, frames);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
