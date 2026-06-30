import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export function bundleAtlasViewerStyles(): string {
  return `
.atlas-static-shell {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 70vh;
}

.atlas-static-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.atlas-static-home {
  color: #94a3b8;
  font-size: 0.875rem;
  text-decoration: none;
}

.atlas-static-home:hover {
  color: #38bdf8;
}

.atlas-static-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  font-size: 0.875rem;
  color: #94a3b8;
}

.atlas-static-breadcrumb a {
  color: #38bdf8;
  text-decoration: none;
}

.atlas-static-sep {
  opacity: 0.5;
}

.atlas-static-title {
  margin: 0;
  font-size: 1.35rem;
  color: #e2e8f0;
}

.atlas-static-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.atlas-static-toolbar button {
  min-width: 2.25rem;
  padding: 0.35rem 0.65rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(15, 23, 42, 0.65);
  color: #e2e8f0;
  cursor: pointer;
}

.atlas-static-toolbar button:hover {
  border-color: rgba(56, 189, 248, 0.45);
  color: #38bdf8;
}

.atlas-static-hint {
  font-size: 0.78rem;
  color: #64748b;
}

.atlas-static-canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 420px;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.15);
  overflow: hidden;
  background: #f2e8c9;
}

.atlas-static-canvas-wrap canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.atlas-static-canvas-wrap canvas:active {
  cursor: grabbing;
}

.atlas-static-decor {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}

.atlas-static-scale span {
  font-size: 0.72rem;
  color: #1a1008;
  font-family: serif;
}

.atlas-static-empty {
  color: #94a3b8;
  padding: 1rem 0;
}
`;
}

export function renderAtlasViewerPage(input: {
  worldName: string;
  mapTitle: string;
  cssHref: string;
  homeHref: string;
}): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.mapTitle)} — ${escapeHtml(input.worldName)}</title>
  <meta name="description" content="Statischer Atlas-Export von ${escapeHtml(input.worldName)}">
  <link rel="stylesheet" href="${escapeAttr(input.cssHref)}">
  <style>${bundleAtlasViewerStyles()}</style>
</head>
<body>
  <div class="uwe-shell">
    <div class="static-export-banner">Statischer UWE-Export — ${escapeHtml(input.worldName)}</div>
    <header class="uwe-topbar">
      <a class="uwe-brand" href="${escapeAttr(input.homeHref)}">
        <span class="uwe-brand-mark">◆</span>
        <span>
          <strong>UWE Portal</strong>
          <small>${escapeHtml(input.worldName)}</small>
        </span>
      </a>
    </header>
    <main class="uwe-main" style="max-width:1200px;margin:0 auto;padding:1rem;">
      <div data-atlas-viewer></div>
    </main>
  </div>
  <script src="atlas-viewer.js" defer></script>
</body>
</html>`;
}

export function copyAtlasViewerScript(atlasDir: string): string {
  const source = path.resolve(packageRoot, "../static/atlas-viewer.js");
  const target = path.join(atlasDir, "atlas-viewer.js");
  fs.copyFileSync(source, target);
  return path.basename(target);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}
