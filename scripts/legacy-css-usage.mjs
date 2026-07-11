#!/usr/bin/env node
/**
 * Legacy-CSS-Rückbau: findet CSS-Regeln, deren Klassen nirgends mehr
 * referenziert werden, und entfernt sie auf Wunsch.
 *
 * Analyse-Basis: alle .tsx/.ts unter apps/, packages/, tools/ (ohne
 * node_modules/.next/dist) — inkl. dynamischer Klassen-Präfixe wie
 * `uwe-label-el-${type}` (Präfix-Match). Eine Regel wird nur entfernt,
 * wenn JEDE Klasse in ihrem Selektor unbenutzt ist; Regeln ohne
 * Klassen-Selektor (Element-/Attribut-/:root-Regeln) bleiben immer.
 *
 * Nutzung:
 *   node scripts/legacy-css-usage.mjs           # Statistik pro Datei
 *   node scripts/legacy-css-usage.mjs --dead    # tote Klassen auflisten
 *   node scripts/legacy-css-usage.mjs --write   # tote Regeln entfernen
 *   node scripts/legacy-css-usage.mjs --precise # Token-genaues Matching:
 *       Substring-Matching hält Präfix-Klassen künstlich am Leben (z. B.
 *       "uwe-sidebar" via "uwe-sidebar-section"). --precise verlangt, dass
 *       der Klassenname im Quelltext als vollständiges Token vorkommt
 *       (kein [A-Za-z0-9_-] direkt davor/danach); dynamische Präfixe wie
 *       `uwe-label-el-${…}` werden weiterhin über Präfix-Match gehalten.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const args = process.argv.slice(2);
const write = args.includes("--write");
const listDead = args.includes("--dead");
const precise = args.includes("--precise");

const CSS_FILES = [
  "packages/shared-ui/src/uwe.css",
  "packages/shared-ui/src/uwe-components.css",
  "packages/shared-ui/src/uwe-visual-polish.css",
  "packages/shared-ui/src/design-v2/wiki.css",
  "packages/shared-ui/src/design-v2/parchment-os-shell.css",
  "apps/studio/app/wiki.css",
  "apps/portal/app/wiki.css",
];

const SCAN_DIRS = ["apps", "packages", "tools"];
const EXCLUDED = new Set(["node_modules", ".next", ".turbo", "dist", "build", "coverage", "generated", "src-tauri"]);

function collectSources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED.has(entry.name)) collectSources(abs, out);
    } else if (
      /\.(tsx|ts|mjs|css)$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts") &&
      // Testdateien zählen nicht als Nutzer: CSS-Content-Assertions
      // (assert.match(uweCss, /klasse/)) würden Regeln zirkulär am Leben halten.
      !/\.test\.(tsx|ts)$/.test(entry.name)
    ) {
      out.push(abs);
    }
  }
  return out;
}

// Gesamten Quelltext einlesen (für Substring-Checks) + dynamische Präfixe sammeln.
// CSS-Dateien außerhalb der Rückbau-Liste zählen als Nutzer (z. B. app.css des
// Connectors); die Rückbau-Dateien selbst nicht — sonst hält jede Klasse sich
// über ihre eigene Definition am Leben.
const cssFileSet = new Set(CSS_FILES.map((rel) => path.join(root, rel)));

/**
 * Kommentare zählen nicht als Nutzer: Code-Kommentare zitieren oft Selektoren
 * (".uwe-shell[data-has-bottom-nav]") und würden Regeln zirkulär am Leben
 * halten. Grob, aber ausreichend: Block-Kommentare komplett, //-Kommentare nur
 * als ganze Zeile (um "https://…" in Strings nicht zu zerschneiden).
 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

let corpus = "";
const dynamicPrefixes = new Set();
for (const dir of SCAN_DIRS) {
  for (const file of collectSources(path.join(root, dir))) {
    if (cssFileSet.has(file)) continue;
    const raw = fs.readFileSync(file, "utf8");
    const text = file.endsWith(".css") ? raw : stripComments(raw);
    corpus += text + "\n";
    if (file.endsWith(".css")) continue;
    for (const m of text.matchAll(/["'`]([a-zA-Z0-9_-]*-)\$\{/g)) {
      if (m[1].length > 3) dynamicPrefixes.add(m[1]);
    }
  }
}

const preciseCache = new Map();
function classUsed(cls) {
  if (precise) {
    let hit = preciseCache.get(cls);
    if (hit === undefined) {
      const re = new RegExp(
        `(?<![A-Za-z0-9_-])${cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_-])`,
      );
      hit = re.test(corpus);
      preciseCache.set(cls, hit);
    }
    if (hit) return true;
  } else if (corpus.includes(cls)) {
    return true;
  }
  for (const prefix of dynamicPrefixes) {
    if (cls.startsWith(prefix)) return true;
  }
  return false;
}

// CSS in Top-Level-Blöcke zerlegen (balancierte Klammern, @media rekursiv)
function splitBlocks(css) {
  const blocks = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) {
      blocks.push({ type: "raw", text: css.slice(i) });
      break;
    }
    const header = css.slice(i, open);
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    blocks.push({ type: "rule", header, body: css.slice(open + 1, j - 1), full: css.slice(i, j) });
    i = j;
  }
  return blocks;
}

function classesInSelector(selector) {
  return [...selector.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((m) => m[1]);
}

const allDead = new Set();
let totalRemovedLines = 0;

for (const rel of CSS_FILES) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  const css = fs.readFileSync(abs, "utf8");
  const blocks = splitBlocks(css);
  let removed = 0;

  function processBlocks(list) {
    const out = [];
    for (const block of list) {
      if (block.type === "raw") {
        out.push(block.text);
        continue;
      }
      const headerTrim = block.header.trim();
      if (headerTrim.startsWith("@media") || headerTrim.startsWith("@supports") || headerTrim.startsWith("@layer")) {
        const inner = processBlocks(splitBlocks(block.body)).join("");
        if (inner.trim()) out.push(`${block.header}{${inner}}`);
        else removed++;
        continue;
      }
      if (headerTrim.startsWith("@")) {
        out.push(block.full); // @keyframes, @import, @font-face etc. behalten
        continue;
      }
      const classes = classesInSelector(block.header);
      if (classes.length === 0) {
        out.push(block.full);
        continue;
      }
      const anyUsed = classes.some((cls) => classUsed(cls));
      if (anyUsed) out.push(block.full);
      else {
        removed++;
        classes.forEach((cls) => allDead.add(cls));
      }
    }
    return out;
  }

  const result = processBlocks(blocks, true).join("");
  const before = css.split("\n").length;
  const after = result.split("\n").length;
  totalRemovedLines += before - after;
  console.log(
    `${rel.padEnd(52)} ${String(before).padStart(5)} -> ${String(after).padStart(5)} Zeilen (${removed} Regeln tot)`,
  );
  if (write && removed > 0) fs.writeFileSync(abs, result);
}

console.log(`\nGesamt entfernbar: ${totalRemovedLines} Zeilen`);
if (listDead) {
  console.log("\nTote Klassen:");
  console.log([...allDead].sort().join("\n"));
}
if (write) console.log("--write: tote Regeln entfernt.");
