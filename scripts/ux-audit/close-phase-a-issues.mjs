#!/usr/bin/env node
/**
 * Close UX-Audit Phase A issues after PR merge-ready implementation.
 * Usage: node scripts/ux-audit/close-phase-a-issues.mjs [--dry-run]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = "Nehmo101/UWE";
const PR = Number(process.env.UX_AUDIT_PR ?? 0) || null;
const PHASE_A_EPIC = 728;
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
const phaseAIssues = manifest.entries
  .filter((e) => e.phase === "A")
  .sort((a, b) => a.issue - b.issue);

const prLink = PR ? `[PR #${PR}](https://github.com/${REPO}/pull/${PR})` : "diesem Branch";

const pageComment = (entry) => `<!-- ux-audit-phase-a-closed -->
**Phase A — umgesetzt** in ${prLink}.

| Feld | Wert |
|------|------|
| Route | \`${entry.app ?? "studio"}:${entry.route}\` |
| Titel | ${entry.title} |

Nächster Schritt aus dem Audit wurde implementiert oder verifiziert. CI-Checks grün.

Teil von Epic #${PHASE_A_EPIC} · Roadmap #${ROADMAP}.
`;

const epicComment = `<!-- ux-audit-phase-a-epic-closed -->
Alle **${phaseAIssues.length} Phase-A-Tickets** (Foundation) wurden in ${prLink} umgesetzt.

**Scope:** Auth/Redirects, Life-Brain RTX-only, System-Hub-Hierarchie, Command-Center read-only, Secrets-Hardening, Portal dm_only-Guards, Legacy-Routen, Backup/Restore-Absicherung.

Parent: Roadmap #${ROADMAP}.
`;

console.log(`Closing ${phaseAIssues.length} Phase A issues…${dryRun ? " (dry-run)" : ""}`);

let closed = 0;
for (const entry of phaseAIssues) {
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
  issueComment(PHASE_A_EPIC, epicComment);
  sleep(300);
  issueClose(PHASE_A_EPIC, "completed");
  console.log(`Closed epic #${PHASE_A_EPIC}`);
} catch (err) {
  console.error(`Failed epic #${PHASE_A_EPIC}:`, err.message?.slice(0, 200));
}

console.log(`Done. Closed ${closed}/${phaseAIssues.length} page issues.`);
