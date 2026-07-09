#!/usr/bin/env node
/**
 * Links UX-audit page issues into GitHub Epic hierarchy:
 *   #543 Roadmap (main epic)
 *     ├── Phase A epic
 *     ├── Phase B epic
 *     ├── Phase C epic
 *     └── Phase D epic
 *         └── page issues #544–#725
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(__dirname, "issue-manifest.json");
const REPO = "Nehmo101/UWE";
const MAIN_EPIC = 543;

const PHASE_META = {
  A: {
    title: "[UX-Audit][Epic] Phase A — Quick Wins",
    milestone: "UX-Audit · Phase A",
    body: `<!-- ux-audit-phase-epic -->
# Phase A — Quick Wins

**Parent Epic:** #${MAIN_EPIC}

Bugs, fehlende Auth-Guards, kaputte Wiki-URLs, Portal-Security, tote Links, Admin Dead-Branches.

Alle Tickets dieser Phase sind Sub-Issues dieses Epics und gehören zur Roadmap #${MAIN_EPIC}.
`,
  },
  B: {
    title: "[UX-Audit][Epic] Phase B — UX-Entlastung",
    milestone: "UX-Audit · Phase B",
    body: `<!-- ux-audit-phase-epic -->
# Phase B — UX-Entlastung

**Parent Epic:** #${MAIN_EPIC}

Seiten mit Überladung 4–5: View/Edit-Trennung, Collapse-Formulare, Dashboard-Entlastung.

Parent: Roadmap #${MAIN_EPIC}.
`,
  },
  C: {
    title: "[UX-Audit][Epic] Phase C — Architektur & Skalierung",
    milestone: "UX-Audit · Phase C",
    body: `<!-- ux-audit-phase-epic -->
# Phase C — Architektur & Skalierung

**Parent Epic:** #${MAIN_EPIC}

Settings↔Setup, Status-Hierarchie, Portal DB-Filter, SSR-Seeds, N+1, Pagination.

Parent: Roadmap #${MAIN_EPIC}.
`,
  },
  D: {
    title: "[UX-Audit][Epic] Phase D — Polish",
    milestone: "UX-Audit · Phase D",
    body: `<!-- ux-audit-phase-epic -->
# Phase D — Polish

**Parent Epic:** #${MAIN_EPIC}

generateMetadata, Breadcrumbs, Copy-Buttons, CSS-Konsistenz, leere Tabs.

Parent: Roadmap #${MAIN_EPIC}.
`,
  },
};

function gh(args, input) {
  if (input !== undefined) {
    return execFileSync("gh", args, { encoding: "utf8", input, maxBuffer: 20 * 1024 * 1024 });
  }
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function issueNodeId(number) {
  return gh(["issue", "view", String(number), "--repo", REPO, "--json", "id", "-q", ".id"]).trim();
}

function addSubIssue(parentId, childId, replaceParent = true) {
  const query = `mutation { addSubIssue(input: { issueId: "${parentId}", subIssueId: "${childId}", replaceParent: ${replaceParent} }) { subIssue { number } } }`;
  gh(["api", "graphql", "-H", "GraphQL-Features: sub_issues", "-f", `query=${query}`]);
}

function ensureMilestone(title, description) {
  try {
    gh(["api", `repos/${REPO}/milestones`, "-f", `title=${title}`, "-f", `description=${description}`, "-f", "state=open"]);
  } catch {
    // exists
  }
  const milestones = JSON.parse(gh(["api", `repos/${REPO}/milestones`, "--paginate"]));
  const found = milestones.find((m) => m.title === title);
  if (!found) throw new Error(`Milestone not found: ${title}`);
  return found;
}

function setMilestone(issueNumber, milestoneTitle) {
  gh(["issue", "edit", String(issueNumber), "--repo", REPO, "--milestone", milestoneTitle]);
}

function createPhaseEpic(phase, meta, parentId) {
  const out = gh([
    "issue",
    "create",
    "--repo",
    REPO,
    "--title",
    meta.title,
    "--body",
    meta.body,
    "--label",
    "ux-audit",
    "--label",
    "roadmap",
    "--label",
    "enhancement",
    `--label`,
    `phase-${phase.toLowerCase()}`,
  ]);
  const match = out.match(/issues\/(\d+)/);
  const number = match ? Number(match[1]) : 0;
  sleep(400);
  const id = issueNodeId(number);
  addSubIssue(parentId, id);
  sleep(300);
  setMilestone(number, meta.milestone);
  console.log(`Phase ${phase} epic #${number}`);
  return number;
}

function buildMainEpicBody(manifest, phaseEpics) {
  const stats = (phase) => {
    const items = manifest.entries.filter((e) => e.phase === phase);
    return { count: items.length, p1: items.filter((e) => e.topPriority === "P1").length };
  };

  const phaseSection = (phase, epicNum) => {
    const s = stats(phase);
    const items = manifest.entries
      .filter((e) => e.phase === phase)
      .sort((a, b) => a.issue - b.issue);
    const list = items
      .map(
        (e) =>
          `- [#${e.issue}](https://github.com/${REPO}/issues/${e.issue}) \`${e.app ?? "studio"}:${e.route}\` — ${e.title} (${e.topPriority})`,
      )
      .join("\n");
    return `### Phase ${phase}: [#${epicNum}](https://github.com/${REPO}/issues/${epicNum}) (${s.count} Tickets, ${s.p1}× P1)\n\n${list}`;
  };

  return `<!-- ux-audit-roadmap-epic -->
# UWE UX-Audit — Epic & Roadmap

**Typ:** Epic (Parent-Issue)  
**Scope:** ${manifest.entries.length} Seiten-Tickets · Studio · Welt-Cockpit · Portal  
**Manifest:** \`scripts/ux-audit/issue-manifest.json\`

---

## Epic-Hierarchie

\`\`\`
#${MAIN_EPIC}  UX-Audit Roadmap (dieses Epic)
├── #${phaseEpics.A}  Phase A — Quick Wins
├── #${phaseEpics.B}  Phase B — UX-Entlastung
├── #${phaseEpics.C}  Phase C — Architektur
└── #${phaseEpics.D}  Phase D — Polish
    └── #544–#725  Seiten-Tickets (Sub-Issues der Phasen-Epics)
\`\`\`

## Fortschritt

Sub-Issues und Fortschritt werden in der GitHub-UI unter **Sub-issues** dieses Epics angezeigt.

| Phase | Epic | Tickets | P1 |
|-------|------|---------|-----|
| A | #${phaseEpics.A} | ${stats("A").count} | ${stats("A").p1} |
| B | #${phaseEpics.B} | ${stats("B").count} | ${stats("B").p1} |
| C | #${phaseEpics.C} | ${stats("C").count} | ${stats("C").p1} |
| D | #${phaseEpics.D} | ${stats("D").count} | ${stats("D").p1} |

## Priorität

1. **Sprint 1:** Phase A — alle P1-Tickets (${manifest.entries.filter((e) => e.phase === "A" && e.topPriority === "P1").length} Stück)
2. **Sprint 2:** Phase B — P1 + Überladung ≥4
3. **Sprint 3:** Phase C — Architektur
4. **Laufend:** Phase D — Polish

---

## Alle Tickets nach Phase

${phaseSection("A", phaseEpics.A)}

---

${phaseSection("B", phaseEpics.B)}

---

${phaseSection("C", phaseEpics.C)}

---

${phaseSection("D", phaseEpics.D)}
`;
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const parentId = issueNodeId(MAIN_EPIC);

  // Milestones
  for (const phase of ["A", "B", "C", "D"]) {
    ensureMilestone(PHASE_META[phase].milestone, `UX-Audit Roadmap Phase ${phase}`);
    sleep(200);
  }
  ensureMilestone("UX-Audit", "Gesamt-Epic UX-Audit aller Seiten");
  sleep(200);

  let phaseEpics = manifest.phaseEpics ?? {};

  for (const phase of ["A", "B", "C", "D"]) {
    if (!phaseEpics[phase]) {
      phaseEpics[phase] = createPhaseEpic(phase, PHASE_META[phase], parentId);
    } else {
      console.log(`Phase ${phase} epic exists #${phaseEpics[phase]}`);
    }
  }

  const linked = new Set(manifest.linkedSubIssues ?? []);
  const phaseParentIds = Object.fromEntries(
    Object.entries(phaseEpics).map(([ph, num]) => [ph, issueNodeId(num)]),
  );

  for (const entry of manifest.entries) {
    const key = entry.issue;
    if (linked.has(key)) {
      continue;
    }
    const childId = issueNodeId(entry.issue);
    const phaseParent = phaseParentIds[entry.phase];
    try {
      addSubIssue(phaseParent, childId);
      setMilestone(entry.issue, PHASE_META[entry.phase].milestone);
      linked.add(key);
      console.log(`Linked #${entry.issue} → Phase ${entry.phase} epic`);
      sleep(280);
    } catch (err) {
      console.error(`Failed #${entry.issue}:`, err.message?.slice(0, 200));
    }

    if (linked.size % 20 === 0) {
      manifest.linkedSubIssues = [...linked];
      manifest.phaseEpics = phaseEpics;
      writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    }
  }

  manifest.linkedSubIssues = [...linked];
  manifest.phaseEpics = phaseEpics;
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  // Update main epic
  const body = buildMainEpicBody(manifest, phaseEpics);
  gh(["issue", "edit", String(MAIN_EPIC), "--repo", REPO, "--title", "[Epic][UX-Audit] Roadmap — Studio, Welt-Cockpit & Portal", "--body", body]);
  setMilestone(MAIN_EPIC, "UX-Audit");
  gh(["issue", "edit", String(MAIN_EPIC), "--repo", REPO, "--add-label", "epic"]);

  try {
    gh(["label", "create", "epic", "--repo", REPO, "--color", "7B1FA2", "--description", "Epic / Parent issue", "--force"]);
  } catch {
    /* ok */
  }

  console.log(`Done. Linked ${linked.size}/${manifest.entries.length} sub-issues.`);
  console.log(`Main epic: #${MAIN_EPIC}`);
  console.log(`Phase epics:`, phaseEpics);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
