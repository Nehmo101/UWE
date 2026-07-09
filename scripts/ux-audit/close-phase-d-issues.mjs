#!/usr/bin/env node
/**
 * Close UX-Audit Phase D page issues after PR merge-ready implementation.
 * Usage: node scripts/ux-audit/close-phase-d-issues.mjs [--dry-run]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = "Nehmo101/UWE";
const PR = 735;
const PHASE_D_EPIC = 731;
const ROADMAP = 543;

const dryRun = process.argv.includes("--dry-run");

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function gh(args, input) {
  if (input !== undefined) {
    return execFileSync("gh", args, { encoding: "utf8", input, maxBuffer: 20 * 1024 * 1024 });
  }
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function issueComment(issue, body) {
  if (dryRun) {
    console.log(`[dry-run] comment #${issue}`);
    return;
  }
  gh(["issue", "comment", String(issue), "--repo", REPO, "--body", body]);
}

function issueClose(issue, reason) {
  if (dryRun) {
    console.log(`[dry-run] close #${issue}: ${reason}`);
    return;
  }
  gh(["issue", "close", String(issue), "--repo", REPO, "--reason", reason]);
}

const manifest = JSON.parse(readFileSync(join(__dirname, "issue-manifest.json"), "utf8"));
const phaseDIssues = manifest.entries
  .filter((e) => e.phase === "D")
  .sort((a, b) => a.issue - b.issue);

const pageComment = (entry) => `<!-- ux-audit-phase-d-closed -->
**Phase D — umgesetzt** in [PR #${PR}](https://github.com/${REPO}/pull/${PR}).

| Feld | Wert |
|------|------|
| Route | \`${entry.app ?? "studio"}:${entry.route}\` |
| Titel | ${entry.title} |

Nächster Schritt aus dem Audit wurde implementiert. \`pnpm lint\` / \`pnpm typecheck\` / PR \`fast-checks\` grün.

Teil von Epic #${PHASE_D_EPIC} · Roadmap #${ROADMAP}.
`;

const epicComment = `<!-- ux-audit-phase-d-epic-closed -->
Alle **${phaseDIssues.length} Phase-D-Tickets** (Polish) wurden in [PR #${PR}](https://github.com/${REPO}/pull/${PR}) umgesetzt.

**Scope:** generateMetadata-Patterns, Copy-Buttons, Hub-Stats, Auth-Polish, Admin/System-UX, Portal-Spieler-Ansicht, Welt-Cockpit-Verfeinerungen.

Parent: Roadmap #${ROADMAP}.
`;

console.log(`Closing ${phaseDIssues.length} Phase D issues…${dryRun ? " (dry-run)" : ""}`);

let closed = 0;
for (const entry of phaseDIssues) {
  try {
    issueComment(entry.issue, pageComment(entry));
    sleep(280);
    issueClose(entry.issue, "completed");
    closed += 1;
    console.log(`Closed #${entry.issue} ${entry.route}`);
    sleep(320);
  } catch (err) {
    console.error(`Failed #${entry.issue}:`, err.message?.slice(0, 200));
  }
}

try {
  issueComment(PHASE_D_EPIC, epicComment);
  sleep(300);
  issueClose(PHASE_D_EPIC, "completed");
  console.log(`Closed epic #${PHASE_D_EPIC}`);
} catch (err) {
  console.error(`Failed epic #${PHASE_D_EPIC}:`, err.message?.slice(0, 200));
}

console.log(`Done. Closed ${closed}/${phaseDIssues.length} page issues.`);
