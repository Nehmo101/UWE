#!/usr/bin/env node
/**
 * Design-Konsolidierung: Inventar der Styling-Generationen pro Seite.
 *
 * Zählt für jede page.tsx (und optional jede Komponenten-Datei) unter apps/*:
 *   - legacy:  uwe-*-Klassen (ohne uwe-v2-*)
 *   - v2:      uwe-v2-*-Klassen
 *   - kit:     Imports aus src/components/ui (Ziel-Stack, shadcn-Stil)
 *   - inline:  style={{ …-Vorkommen
 *
 * Nutzung:
 *   node scripts/design-consolidation-inventory.mjs            # Zusammenfassung
 *   node scripts/design-consolidation-inventory.mjs --json     # Voll-Report (JSON)
 *   node scripts/design-consolidation-inventory.mjs --app portal
 *
 * Ziel-Definition „fertig migriert": legacy = 0, v2 = 0, inline <= 2, kit > 0
 * (siehe docs/engineering/design-consolidation.md).
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const appFilter = args.includes("--app") ? args[args.indexOf("--app") + 1] : null;

const APPS = ["apps/studio/app", "apps/portal/app"].filter(
  (dir) => !appFilter || dir.includes(`/${appFilter}/`),
);

function collectPages(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) collectPages(absolute, results);
    else if (entry.name === "page.tsx") results.push(absolute);
  }
  return results;
}

function classify(source, isPortal) {
  let legacy = (source.match(/["'`{ ]uwe-(?!v2-)[a-z][a-z0-9-]*/g) ?? []).length;
  if (isPortal) {
    // Portal-Legacy heißt auth-* / portal-* (eigene Alt-CSS-Generation).
    legacy += (source.match(/["'` ](auth|portal)-[a-z][a-z0-9-]*/g) ?? []).length;
  }
  const v2 = (source.match(/uwe-v2-[a-z0-9-]*/g) ?? []).length;
  const kit = (source.match(/from ["']@\/(src\/)?components\/ui["']/g) ?? []).length;
  const inline = (source.match(/style=\{\{/g) ?? []).length;
  return { legacy, v2, kit, inline };
}

function statusOf(counts) {
  if (counts.legacy === 0 && counts.v2 === 0 && counts.inline <= 2) return "fertig";
  if (counts.kit > 0) return "gemischt+kit";
  if (counts.v2 > 0 && counts.legacy > 0) return "gemischt";
  if (counts.v2 > 0) return "v2";
  if (counts.legacy > 0) return "legacy";
  return "fertig";
}

const report = [];
for (const appDir of APPS) {
  for (const file of collectPages(path.join(root, appDir))) {
    const rel = path.relative(root, file);
    const counts = classify(fs.readFileSync(file, "utf8"), appDir.includes("portal"));
    report.push({ file: rel, ...counts, status: statusOf(counts) });
  }
}

report.sort((a, b) => b.legacy + b.v2 - (a.legacy + a.v2));

if (asJson) {
  console.log(JSON.stringify(report, null, 1));
} else {
  const byStatus = {};
  for (const entry of report) byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1;
  console.log(`Seiten gesamt: ${report.length}`);
  for (const [status, count] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(14)} ${count}`);
  }
  console.log("\nTop 20 (meiste Legacy/V2-Vorkommen):");
  for (const entry of report.slice(0, 20)) {
    console.log(
      `  ${String(entry.legacy).padStart(3)} legacy ${String(entry.v2).padStart(3)} v2 ${String(entry.inline).padStart(3)} inline  ${entry.file}`,
    );
  }
}
