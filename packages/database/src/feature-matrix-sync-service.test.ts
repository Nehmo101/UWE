import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createDevIdeaService } from "./dev-idea-service";
import {
  FEATURE_MATRIX_ENRICHMENT,
  loadFeatureMatrixMarkdown,
  maturityToLifecycle,
  parseFeatureMatrixOverviewTable,
  parseFeatureMatrixUpsertCandidates,
  rowToUpsertCandidate,
  syncFeatureMatrixToDevIdeas,
} from "./feature-matrix-sync-service";
import { createTestDatabaseUrl } from "./test-helpers";

const SAMPLE_TABLE = `
## Übersicht

| # | Feature | Gesamtstatus | Nutzbar | Production-ready |
|---|---------|--------------|---------|------------------|
| 1 | Image Studio | Phase 2 (Inpaint-UI) | Ja (Generierung + Inpaint) | Nein |
| 3 | DnD API / offene Quellen | Stable (Kern) | Ja (Suche + Statblock-Import) | Ja (Kern) |
| 10 | Global Search 2.0 | Erweiterte Suche v1 | Ja | Ja (Kern) |

---
`;

describe("parseFeatureMatrixOverviewTable", () => {
  it("parses numbered overview rows and ignores header/separator", () => {
    const rows = parseFeatureMatrixOverviewTable(SAMPLE_TABLE);
    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.number, 1);
    assert.equal(rows[0]?.title, "Image Studio");
    assert.equal(rows[0]?.overallStatus, "Phase 2 (Inpaint-UI)");
    assert.equal(rows[1]?.number, 3);
    assert.equal(rows[2]?.title, "Global Search 2.0");
  });

  it("loads every feature from the repo matrix doc", () => {
    const markdown = loadFeatureMatrixMarkdown();
    const rows = parseFeatureMatrixOverviewTable(markdown);
    // 14 Zeilen, aber Nummern bis 15: #4 (Agent Jobs) wurde entfernt.
    assert.equal(rows.length, 14);
    assert.equal(rows[0]?.title, "Image Studio");
    assert.equal(rows[13]?.number, 15);
    assert.ok(rows.every((row) => FEATURE_MATRIX_ENRICHMENT[row.number]));
  });
});

describe("rowToUpsertCandidate", () => {
  it("maps stable maturity to existing lifecycle", () => {
    const candidate = rowToUpsertCandidate({
      number: 3,
      title: "DnD API / offene Quellen",
      overallStatus: "Stable (Kern)",
      usable: "Ja",
      productionReady: "Ja (Kern)",
    });
    assert.equal(candidate.maturityLevel, "stable");
    assert.equal(candidate.lifecycle, "existing");
    assert.equal(candidate.module, "dnd");
    assert.equal(candidate.ideaType, "feature");
  });

  it("maps lab and beta maturity to planned lifecycle", () => {
    assert.equal(maturityToLifecycle("lab"), "planned");
    assert.equal(maturityToLifecycle("beta"), "planned");

    const lab = rowToUpsertCandidate({
      number: 1,
      title: "Image Studio",
      overallStatus: "Phase 2",
      usable: "Ja",
      productionReady: "Nein",
    });
    assert.equal(lab.maturityLevel, "lab");
    assert.equal(lab.lifecycle, "planned");
  });
});

describe("parseFeatureMatrixUpsertCandidates", () => {
  it("returns feature upsert candidates with matrix metadata", () => {
    const candidates = parseFeatureMatrixUpsertCandidates(SAMPLE_TABLE);
    assert.equal(candidates.length, 3);
    const search = candidates.find((c) => c.title === "Global Search 2.0");
    assert.ok(search);
    assert.equal(search.module, "studio");
    assert.equal(search.metadata.source, "feature_maturity_matrix");
    assert.equal(search.metadata.matrixNumber, 10);
  });
});

describe("syncFeatureMatrixToDevIdeas", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("creates new feature ideas and updates existing ones by title", async () => {
    const ideas = createDevIdeaService(db);
    const existing = await ideas.createIdea({
      title: "Image Studio",
      body: "Manuell angelegt",
      ideaType: "feature",
      lifecycle: "planned",
    });

    const result = await syncFeatureMatrixToDevIdeas(db, { matrixMarkdown: SAMPLE_TABLE });
    assert.equal(result.total, 3);
    assert.equal(result.created, 2);
    assert.equal(result.updated, 1);

    const updated = await ideas.getIdea(existing.id);
    assert.ok(updated);
    assert.equal(updated.module, "media");
    assert.equal(updated.maturityLevel, "lab");
    assert.equal(updated.body, "Manuell angelegt");

    const created = await db.devIdea.findFirst({
      where: { title: "Global Search 2.0", ideaType: "feature" },
    });
    assert.ok(created);
    assert.equal(created.lifecycle, "existing");

    await ideas.deleteIdea(existing.id);
    if (created) await ideas.deleteIdea(created.id);
    const dnd = await db.devIdea.findFirst({ where: { title: "DnD API / offene Quellen" } });
    if (dnd) await ideas.deleteIdea(dnd.id);
  });
});
