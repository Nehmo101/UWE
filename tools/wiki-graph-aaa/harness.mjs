#!/usr/bin/env node
/**
 * Wiki-Graph AAA visual harness:
 * 1) esbuild-bundle the real GraphEngine into harness-bundle.mjs
 * 2) Playwright → harness.html → PNG baselines under shots/
 *
 * Usage:
 *   node tools/wiki-graph-aaa/harness.mjs
 *   node tools/wiki-graph-aaa/harness.mjs --serve-only
 *   node tools/wiki-graph-aaa/harness.mjs --no-open
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.WIKI_GRAPH_HARNESS_PORT || 4177);
const HOST = "127.0.0.1";
const SHOTS = path.join(__dirname, "shots");

const args = new Set(process.argv.slice(2));
const serveOnly = args.has("--serve-only");
const noOpen = args.has("--no-open");
const skipBundle = args.has("--skip-bundle");

function esbuildBin() {
  return path.join(
    ROOT,
    "node_modules",
    ".pnpm",
    "esbuild@0.28.1",
    "node_modules",
    "esbuild",
    "bin",
    "esbuild",
  );
}

async function bundle() {
  const entry = path.join(__dirname, "harness-entry.ts");
  const outfile = path.join(__dirname, "harness-bundle.mjs");
  const graphTypes = path.join(ROOT, "packages/database/src/graph-types.ts");
  const bin = esbuildBin();
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
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });

  if (result.code !== 0) {
    throw new Error(`esbuild failed (${result.code}):\n${result.stderr || result.stdout}`);
  }
  if (result.stderr.trim()) console.log(result.stderr.trim());
  console.log(`bundled → ${path.relative(ROOT, outfile)}`);
  return outfile;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
};

function startStaticServer() {
  const root = __dirname;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
      let rel = decodeURIComponent(url.pathname);
      if (rel === "/") rel = "/progress.html";
      const filePath = path.normalize(path.join(root, rel));
      if (!filePath.startsWith(root)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      const data = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
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

async function portBusy() {
  try {
    const res = await fetch(`http://${HOST}:${PORT}/progress.json`, {
      signal: AbortSignal.timeout(800),
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await portBusy()) {
    console.log(`port ${PORT} already serving — reusing`);
    return { server: null, base: `http://${HOST}:${PORT}` };
  }
  const server = await startStaticServer();
  console.log(`static server http://${HOST}:${PORT}/  (progress.html)`);
  return { server, base: `http://${HOST}:${PORT}` };
}

async function waitReady(page) {
  await page.waitForFunction(() => document.documentElement.dataset.harnessReady === "1", null, {
    timeout: 30_000,
  });
  await page.waitForFunction(() => Boolean(window.__WIKI_GRAPH_HARNESS__?.ready), null, {
    timeout: 30_000,
  });
}

async function shot(page, name) {
  const target = path.join(SHOTS, name);
  const root = page.locator("#harness-root");
  await root.screenshot({ path: target, type: "png" });
  console.log(`shot ${name}`);
  return target;
}

async function capture(base) {
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });

  try {
    await page.goto(`${base}/harness.html`, { waitUntil: "networkidle" });
    await waitReady(page);

    // Physics: undimmed layout shortly after prewarm (communities / forces)
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(false);
      h.setBadge("baseline · physics");
      h.select(null);
      h.setHover(null);
      h.fit();
      h.engine.wake();
      await h.settle(350);
    });
    await shot(page, "before-physics.png");

    // Full settled graph (no selection → no focus dim)
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(false);
      h.setBadge("baseline · full settled");
      h.select(null);
      h.setHover(null);
      h.fit();
      await h.settle(1100);
    });
    await shot(page, "before-full.png");

    // Render polish framing (labels/edges at rest, still undimmed)
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(false);
      h.setBadge("baseline · render");
      h.select(null);
      h.setHover(null);
      h.fit();
      await h.settle(400);
    });
    await shot(page, "before-render.png");

    // Motion: zoomed selection / camera framing
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(false);
      h.setBadge("baseline · motion");
      h.setHover(null);
      h.select(h.hubId());
      h.zoomBy(1.55);
      h.engine.wake();
      await h.settle(500);
    });
    await shot(page, "before-motion.png");

    // Focus / hover dim (selection cleared so hover owns focusSet)
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(false);
      h.setBadge("baseline · focus");
      h.select(null);
      h.fit();
      h.setHover(h.hubId());
      for (let i = 0; i < 40; i++) {
        h.engine.wake();
        await new Promise((r) => requestAnimationFrame(r));
      }
    });
    await shot(page, "before-focus.png");

    // Chrome overlay (GraphView-shaped)
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(true);
      h.setBadge("baseline · chrome");
      h.setHover(null);
      h.select(h.hubId());
      h.fit();
      await h.settle(350);
    });
    await shot(page, "before-chrome.png");

    // Perf framing: denser feel via zoom-out (same fixture, global view)
    await page.evaluate(async () => {
      const h = window.__WIKI_GRAPH_HARNESS__;
      h.setChromeVisible(false);
      h.setBadge("baseline · perf (100 nodes)");
      h.setHover(null);
      h.select(null);
      h.fit();
      h.zoomBy(0.72);
      await h.settle(400);
    });
    await shot(page, "before-perf.png");
  } finally {
    await browser.close();
  }
}

async function openProgress(base) {
  if (noOpen) return;
  const url = `${base}/progress.html`;
  const plat = process.platform;
  try {
    if (plat === "win32") {
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    } else if (plat === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
    console.log(`opened ${url}`);
  } catch (err) {
    console.warn(`could not open browser: ${err?.message || err}`);
    console.log(`open manually: ${url}`);
  }
}

async function patchProgressNotes() {
  const progressPath = path.join(__dirname, "progress.json");
  const raw = await readFile(progressPath, "utf8");
  const data = JSON.parse(raw);
  const stamp = new Date().toISOString();
  data.updatedAt = stamp;
  data.overall = data.overall || "in_progress";
  const note =
    "Baselines captured via tools/wiki-graph-aaa/harness.mjs (real GraphEngine fixture, 100 nodes).";
  for (const piece of data.pieces) {
    piece.criticVerdict = "waiting";
    if (!String(piece.notes || "").includes("Baselines captured")) {
      piece.notes = `${piece.notes ? `${piece.notes} ` : ""}${note}`.trim();
    }
  }
  await writeFile(progressPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log("updated progress.json notes (criticVerdict=waiting)");
}

async function main() {
  if (!skipBundle && !serveOnly) {
    await bundle();
  } else if (!serveOnly) {
    try {
      await stat(path.join(__dirname, "harness-bundle.mjs"));
    } catch {
      await bundle();
    }
  }

  const { server, base } = await ensureServer();

  try {
    if (!serveOnly) {
      await capture(base);
      await patchProgressNotes();
    }
    await openProgress(base);

    if (serveOnly || process.env.WIKI_GRAPH_HARNESS_KEEP === "1") {
      console.log("server kept alive (Ctrl+C to stop)");
      await new Promise(() => {});
    } else if (server) {
      // Keep briefly so the opened browser can load; then stay up for dashboard refresh.
      console.log(`serving until process exit — ${base}/progress.html`);
      await new Promise(() => {});
    } else {
      console.log(`reused existing server — ${base}/progress.html`);
    }
  } catch (err) {
    if (server) server.close();
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
