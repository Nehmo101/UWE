#!/usr/bin/env node
/**
 * Wiki-Graph AAA — REAL GraphView chrome capture (Round 5).
 *
 * Mounts the production `<GraphView>` React tree via createRoot (not the
 * harness.html HTML/CSS mockup), enables Nachbarschaft through the real
 * control, and writes shots/after-chrome.png with badge text
 * "after · chrome (real GraphView)".
 *
 * Usage: node tools/wiki-graph-aaa/capture-chrome-react.mjs
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.WIKI_GRAPH_REACT_PORT || 4179);
const HOST = "127.0.0.1";
const SHOTS = path.join(__dirname, "shots");
const require = createRequire(path.join(ROOT, "apps/studio/package.json"));

async function bundleCss() {
  const postcss = require(
    path.join(
      ROOT,
      "node_modules/.pnpm/@tailwindcss+postcss@4.3.3/node_modules/postcss",
    ),
  );
  const tw = require("@tailwindcss/postcss");
  const inputPath = path.join(ROOT, "apps/studio/wiki-graph-aaa-tw-input.css");
  const outfile = path.join(__dirname, "react-chrome-tw.css");
  const css = await readFile(inputPath, "utf8");
  const result = await postcss([tw]).process(css, { from: inputPath });
  await writeFile(outfile, result.css);
  console.log(`css → ${path.relative(ROOT, outfile)} (${result.css.length} bytes)`);
}

async function bundleJs() {
  const entry = path.join(__dirname, "react-chrome-entry.tsx");
  const outfile = path.join(__dirname, "graphview-bundle.mjs");
  const graphTypes = path.join(ROOT, "packages/database/src/graph-types.ts");
  const enums = path.join(ROOT, "packages/database/src/enums.ts");
  // React lives under packages/shared-ui (pnpm); alias so the tools/ entry resolves.
  const sharedUiRequire = createRequire(path.join(ROOT, "packages/shared-ui/package.json"));
  const react = sharedUiRequire.resolve("react");
  const reactJsx = sharedUiRequire.resolve("react/jsx-runtime");
  const reactDom = sharedUiRequire.resolve("react-dom");
  const reactDomClient = sharedUiRequire.resolve("react-dom/client");
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
        "--jsx=automatic",
        `--outfile=${outfile}`,
        `--alias:@uwe/database/graph-types=${graphTypes}`,
        `--alias:@uwe/database/enums=${enums}`,
        `--alias:react=${react}`,
        `--alias:react/jsx-runtime=${reactJsx}`,
        `--alias:react-dom=${reactDom}`,
        `--alias:react-dom/client=${reactDomClient}`,
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
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

function startStaticServer() {
  const root = __dirname;
  const uweCss = path.join(ROOT, "packages/shared-ui/src/uwe.css");
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
      let filePath;
      if (url.pathname === "/uwe.css") {
        filePath = uweCss;
      } else {
        filePath = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
        if (!filePath.startsWith(root)) {
          res.writeHead(403).end("forbidden");
          return;
        }
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

async function main() {
  if (!process.argv.includes("--skip-bundle")) {
    await bundleCss();
    await bundleJs();
  }

  const server = await startStaticServer();
  const base = `http://${HOST}:${PORT}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });

  try {
    await page.goto(`${base}/react-chrome.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => document.documentElement.dataset.reactChromeReady === "1",
      null,
      { timeout: 30_000 },
    );
    await page.waitForFunction(() => Boolean(window.__WIKI_GRAPH_REACT__?.ready), null, {
      timeout: 30_000,
    });

    // Let the engine paint + settle a bit before flipping Nachbarschaft.
    await page.waitForSelector(".uwe-fdgraph-canvas", { timeout: 15_000 });
    await page.waitForTimeout(1200);

    const enabled = await page.evaluate(async () => {
      const api = window.__WIKI_GRAPH_REACT__;
      return api ? api.enableNeighborhood() : false;
    });
    if (!enabled) {
      throw new Error("failed to enable Nachbarschaft on real GraphView");
    }

    const chromeOk = await page.evaluate(async () => {
      const api = window.__WIKI_GRAPH_REACT__;
      return api ? api.waitForNeighborhoodChrome(12_000) : false;
    });
    if (!chromeOk) {
      throw new Error(
        "Nachbarschaft chrome not ready (expected anchor label, Tiefe stepper, 'X von Y Knoten')",
      );
    }

    // Extra settle so ego-net layout + counts stabilize for the shot.
    await page.waitForTimeout(900);

    // Confirm required chrome surface area is present before shooting.
    const checks = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        badge: (document.getElementById("harness-badge")?.textContent || "").trim(),
        search: Boolean(document.querySelector('input[type="search"]')),
        chipsWithCounts: document.querySelectorAll("button .tabular-nums, button span").length > 0,
        neighborhood: /Nachbarschaft:\s*\S/.test(text),
        depth: /Tiefe/i.test(text),
        liveCounts: /\d+\s+von\s+\d+\s+Knoten/.test(text),
        minimap: Boolean(document.querySelector(".uwe-fdgraph-minimap")),
        zoom: Boolean(document.querySelector('button[aria-label="Vergrößern"]')),
        detail: Boolean(document.querySelector('aside[aria-label="Knoten-Details"]')),
      };
    });
    console.log("chrome checks:", checks);
    const required = ["search", "neighborhood", "depth", "liveCounts", "minimap", "zoom", "detail"];
    for (const key of required) {
      if (!checks[key]) throw new Error(`missing chrome surface: ${key}`);
    }
    if (checks.badge !== "after · chrome (real GraphView)") {
      throw new Error(`unexpected badge text: ${JSON.stringify(checks.badge)}`);
    }

    await mkdir(SHOTS, { recursive: true });
    const target = path.join(SHOTS, "after-chrome.png");
    await page.locator("#frame").screenshot({ path: target, type: "png" });
    console.log(`shot after-chrome.png ← real GraphView`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
