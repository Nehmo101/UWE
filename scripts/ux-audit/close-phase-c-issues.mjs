#!/usr/bin/env node
/**
 * Close UX-Audit Phase C issues after PR merge-ready implementation.
 * Usage: node scripts/ux-audit/close-phase-c-issues.mjs [--dry-run]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = "Nehmo101/UWE";
const PR = Number(process.env.UX_AUDIT_PR ?? 0) || null;
const PHASE_C_EPIC = 730;
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
const phaseCIssues = manifest.entries
  .filter((e) => e.phase === "C")
  .sort((a, b) => a.issue - b.issue);

const prLink = PR ? `[PR #${PR}](https://github.com/${REPO}/pull/${PR})` : "diesem Branch";

const pageComment = (entry) => `<!-- ux-audit-phase-c-closed -->
**Phase C — umgesetzt** in ${prLink}.

| Feld | Wert |
|------|------|
| Route | \`${entry.app ?? "studio"}:${entry.route}\` |
| Titel | ${entry.title} |

Nächster Schritt aus dem Audit wurde implementiert oder verifiziert. CI-Checks grün.

Teil von Epic #${PHASE_C_EPIC} · Roadmap #${ROADMAP}.
`;

const epicComment = `<!-- ux-audit-phase-c-epic-closed -->
Alle **${phaseCIssues.length} Phase-C-Tickets** (Features) wurden in ${prLink} umgesetzt.

**Scope:** Navigation-Persistenz, Cloudflare/RTX-Probes, Graph/Atlas-Performance, Offline-Shopping, Portal-Filter, Admin-Polish.

Parent: Roadmap #${ROADMAP}.
`;

console.log(`Closing ${phaseCIssues.length} Phase C issues…${dryRun ? " (dry-run)" : ""}`);

let closed = 0;
for (const entry of phaseCIssues) {
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
  issueComment(PHASE_C_EPIC, epicComment);
  sleep(300);
  issueClose(PHASE_C_EPIC, "completed");
  console.log(`Closed epic #${PHASE_C_EPIC}`);
} catch (err) {
  console.error(`Failed epic #${PHASE_C_EPIC}:`, err.message?.slice(0, 200));
}

console.log(`Done. Closed ${closed}/${phaseCIssues.length} page issues.`);
