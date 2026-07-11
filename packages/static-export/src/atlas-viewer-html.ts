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

.atlas-static-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(14rem, 18rem);
  gap: 0.75rem;
  align-items: stretch;
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

.atlas-static-legend {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.58);
  color: #cbd5e1;
  padding: 0.75rem;
  overflow: auto;
}

.atlas-static-legend h2 {
  margin: 0 0 0.65rem;
  color: #e2e8f0;
  font-size: 0.9rem;
}

.atlas-static-legend-section + .atlas-static-legend-section {
  margin-top: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
}

.atlas-static-legend-section h3 {
  margin: 0 0 0.4rem;
  color: #94a3b8;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.atlas-static-legend-list {
  display: grid;
  gap: 0.35rem;
}

.atlas-static-legend-row {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr) auto;
  gap: 0.45rem;
  align-items: center;
  min-height: 1.5rem;
  font-size: 0.78rem;
}

.atlas-static-legend-icon {
  display: inline-flex;
  width: 1.25rem;
  height: 1.25rem;
  align-items: center;
  justify-content: center;
}

.atlas-static-legend-swatch,
.atlas-static-legend-mark {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 0.2rem;
  border: 1px solid rgba(226, 232, 240, 0.42);
}

.atlas-static-legend-mark {
  background: linear-gradient(135deg, #b0895b, #f0d19a);
}

.atlas-static-legend-count {
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
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

@media (max-width: 900px) {
  .atlas-static-body {
    grid-template-columns: 1fr;
  }
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
  <script src="atlas-viewer-3d.js" defer></script>
</body>
</html>`;
}

export function copyAtlasViewerScripts(atlasDir: string): string[] {
  const files = ["atlas-viewer.js", "atlas-viewer-3d.js", "atlas-engine.js", "atlas-3d.js"];
  for (const file of files) {
    const source = path.resolve(packageRoot, "../static", file);
    const target = path.join(atlasDir, file);
    fs.copyFileSync(source, target);
  }
  return files;
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
