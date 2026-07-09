#!/usr/bin/env node
/**
 * Creates GitHub issues for every UWE UX-audit page entry.
 * Usage:
 *   node scripts/ux-audit/create-issues.mjs --dry-run
 *   node scripts/ux-audit/create-issues.mjs
 *   node scripts/ux-audit/create-issues.mjs --roadmap-only  # update roadmap from manifest
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES } from "./pages-data.mjs";
import { buildIssueBody, buildIssueTitle, labelsForPage } from "./issue-body-template.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(__dirname, "issue-manifest.json");
const REPO = "Nehmo101/UWE";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const roadmapOnly = args.has("--roadmap-only");

function gh(args, input) {
  const base = ["issue", ...args];
  if (input) {
    return execFileSync("gh", base, { encoding: "utf8", input, maxBuffer: 20 * 1024 * 1024 });
  }
  return execFileSync("gh", base, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function phaseSummary(pages, phase) {
  const subset = pages.filter((p) => p.phase === phase);
  const p1 = subset.filter((p) => p.topPriority === "P1").length;
  return { count: subset.length, p1 };
}

function buildRoadmapBody(manifest, roadmapNumber) {
  const byPhase = { A: [], B: [], C: [], D: [] };
  for (const entry of manifest.entries) {
    byPhase[entry.phase].push(entry);
  }

  const phaseBlock = (phase, title, desc) => {
    const items = byPhase[phase]
      .sort((a, b) => a.route.localeCompare(b.route))
      .map((e) => `- [#${e.issue}](https://github.com/${REPO}/issues/${e.issue}) \`${e.app ?? "studio"}:${e.route}\` — ${e.title} (${e.topPriority}, Überladung ${e.overload}/5)`)
      .join("\n");
    const stats = phaseSummary(manifest.entries.map((e) => e), phase);
    return `## Phase ${phase}: ${title}\n\n${desc}\n\n**${stats.count} Tickets** (${stats.p1}× P1)\n\n${items || "_Keine Tickets_"}`;
  };

  return `<!-- ux-audit-roadmap -->
# UWE UX-Audit — Roadmap & Prioritäten

Diese Roadmap verknüpft **${manifest.entries.length} Seiten-Tickets** aus dem UX/Architektur-Audit (Studio, Welt-Cockpit, Portal).

**Erstellt:** ${manifest.createdAt}  
**Manifest:** \`scripts/ux-audit/issue-manifest.json\`

---

## Prioritäts-Modell

| Label | Bedeutung |
|-------|-----------|
| \`p1-priority\` | Sofort / Bug / Security / Score ≥4 mit klarem Fix |
| \`p2-priority\` | Nächster Sprint — spürbare UX-Verbesserung |
| \`p3-priority\` | Polish, Konsistenz, Nice-to-have |

| Phase | Fokus |
|-------|-------|
| **A** | Quick Wins: Bugs, Guards, kaputte Links, Security |
| **B** | Entlastung: Überladung 4–5, View/Edit-Trennung, Collapse |
| **C** | Architektur: Settings/Status konsolidieren, DB-Filter, SSR |
| **D** | Polish: Metadata, Pagination, CSS, Copy-Buttons |

---

## Übersicht nach App

| Bereich | Tickets | P1 |
|---------|---------|-----|
| Studio (global) | ${manifest.entries.filter((e) => (e.app ?? "studio") === "studio" && !(e.area ?? "").startsWith("Welt")).length} | ${manifest.entries.filter((e) => (e.app ?? "studio") === "studio" && !(e.area ?? "").startsWith("Welt") && e.topPriority === "P1").length} |
| Welt-Cockpit | ${manifest.entries.filter((e) => (e.area ?? "").startsWith("Welt")).length} | ${manifest.entries.filter((e) => (e.area ?? "").startsWith("Welt") && e.topPriority === "P1").length} |
| Portal | ${manifest.entries.filter((e) => e.app === "portal").length} | ${manifest.entries.filter((e) => e.app === "portal" && e.topPriority === "P1").length} |

### Top P1 (sofort angehen)

${manifest.entries
  .filter((e) => e.topPriority === "P1")
  .sort((a, b) => a.phase.localeCompare(b.phase) || a.route.localeCompare(b.route))
  .map((e) => `- [#${e.issue}](https://github.com/${REPO}/issues/${e.issue}) **Phase ${e.phase}** \`${e.app ?? "studio"}:${e.route}\` — ${e.title}`)
  .join("\n")}

### Höchste Überladung (Score 5)

${manifest.entries
  .filter((e) => e.overload === 5)
  .map((e) => `- [#${e.issue}](https://github.com/${REPO}/issues/${e.issue}) \`${e.app ?? "studio"}:${e.route}\` — ${e.title}`)
  .join("\n")}

---

${phaseBlock("A", "Quick Wins", "Bugs, fehlende Auth-Guards, kaputte Wiki-URLs, Portal-PDF-Bug, tote Links, Admin Dead-Branches.")}

---

${phaseBlock("B", "UX-Entlastung", "Seiten mit Überladung 4–5: Dashboards, Wiki-Edit, Session-Detail, Hardware, Kitchen, AI Gateway.")}

---

${phaseBlock("C", "Architektur & Skalierung", "Settings↔Setup, Status-Hierarchie, Portal DB-Filter, SSR-Seeds, N+1, Pagination.")}

---

${phaseBlock("D", "Polish", "generateMetadata, Breadcrumbs, Copy-Buttons, CSS-Konsistenz, leere Tabs.")}

---

## Empfohlene Reihenfolge

1. **Sprint 1 (Phase A):** Alle P1-Tickets Phase A — geschätzt ${manifest.entries.filter((e) => e.phase === "A" && e.topPriority === "P1").length} Issues
2. **Sprint 2 (Phase B, P1):** Wiki-Edit, /today, /assets, Session-Detail, /settings split
3. **Sprint 3 (Phase C):** Portal-Filterung, Settings/Setup, Status-Konsolidierung
4. **Laufend (Phase D):** Restliche P2/P3 pro Bereich

## Agent-Nutzung

Jedes verlinkte Ticket enthält: Zweck, Aufbau, Stärken/Schwächen, P1/P2/P3, nächsten Schritt, Dateipfade und Akzeptanzkriterien — ausreichend für autonome Umsetzung via Cursor Cloud Agent.

---
_Roadmap-Issue #${roadmapNumber}_
`;
}

function createIssue(page, roadmapNumber) {
  const title = buildIssueTitle(page);
  const body = buildIssueBody(page, roadmapNumber);
  const labels = labelsForPage(page);

  if (dryRun) {
    console.log(`[dry-run] ${title}`);
    return { route: page.route, issue: 0, title: page.title, phase: page.phase, topPriority: page.topPriority, overload: page.overload, app: page.app, area: page.area };
  }

  const out = gh([
    "create",
  "--repo",
    REPO,
    "--title",
    title,
    "--body",
    body,
    ...labels.flatMap((l) => ["--label", l]),
  ]);

  const match = out.match(/issues\/(\d+)/);
  const issue = match ? Number(match[1]) : 0;
  console.log(`Created #${issue} ${page.route}`);
  sleep(350); // gentle rate limit
  return {
    route: page.route,
    issue,
    title: page.title,
    phase: page.phase,
    topPriority: page.topPriority,
    overload: page.overload,
    app: page.app,
    area: page.area,
  };
}

async function main() {
  mkdirSync(__dirname, { recursive: true });

  let manifest = existsSync(MANIFEST_PATH)
    ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
    : null;

  if (roadmapOnly) {
    if (!manifest?.roadmapIssue) {
      console.error("No manifest with roadmapIssue found. Run without --roadmap-only first.");
      process.exit(1);
    }
    const body = buildRoadmapBody(manifest, manifest.roadmapIssue);
    if (dryRun) {
      console.log(body.slice(0, 2000));
      return;
    }
    gh(["edit", String(manifest.roadmapIssue), "--repo", REPO, "--body", body]);
    console.log(`Updated roadmap #${manifest.roadmapIssue}`);
    return;
  }

  // Create placeholder roadmap first (updated after all issues exist)
  let roadmapIssue = manifest?.roadmapIssue ?? 0;
  if (!roadmapIssue && !dryRun) {
    const placeholder = `<!-- ux-audit-roadmap-placeholder -->
# UWE UX-Audit — Roadmap (wird aktualisiert)

Erstelle ${PAGES.length} Seiten-Tickets… Manifest: \`scripts/ux-audit/issue-manifest.json\`
`;
    const out = gh([
      "create",
      "--repo",
      REPO,
      "--title",
      "[UX-Audit] Roadmap — Studio, Welt-Cockpit & Portal",
      "--body",
      placeholder,
      "--label",
      "ux-audit",
      "--label",
      "roadmap",
      "--label",
      "documentation",
    ]);
    const match = out.match(/issues\/(\d+)/);
    roadmapIssue = match ? Number(match[1]) : 0;
    console.log(`Created roadmap placeholder #${roadmapIssue}`);
    sleep(500);
  } else if (dryRun) {
    roadmapIssue = 99999;
    console.log("[dry-run] roadmap #99999");
  }

  const pageKey = (page) => `${page.app}:${page.route}`;
  const existingKeys = new Set(manifest?.entries?.map((e) => `${e.app ?? "studio"}:${e.route}`) ?? []);
  const entries = manifest?.entries ? [...manifest.entries] : [];

  for (const page of PAGES) {
    const key = pageKey(page);
    if (existingKeys.has(key)) {
      console.log(`Skip (exists) ${key}`);
      continue;
    }
    const entry = createIssue(page, roadmapIssue);
    entries.push({ ...entry, app: page.app, area: page.area });
    existingKeys.add(key);

    if (!dryRun) {
      manifest = {
        createdAt: manifest?.createdAt ?? new Date().toISOString(),
        roadmapIssue,
        entries,
      };
      writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    }
  }

  manifest = {
    createdAt: manifest?.createdAt ?? new Date().toISOString(),
    roadmapIssue,
    entries,
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  if (!dryRun && roadmapIssue) {
    const body = buildRoadmapBody(manifest, roadmapIssue);
    gh(["edit", String(roadmapIssue), "--repo", REPO, "--body", body]);
    console.log(`Updated roadmap #${roadmapIssue} with ${entries.length} links`);
  }

  console.log(`Done. ${entries.length} entries in manifest.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
