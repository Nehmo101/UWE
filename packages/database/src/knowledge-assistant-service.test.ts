import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  assessConfidence,
  buildCitations,
  buildKnowledgeAnswer,
  buildSynthesisPrompt,
  createKnowledgeAssistantService,
  sourceAgeNote,
  synthesizeKnowledgeAnswer,
} from "./knowledge-assistant-service";
import type { PersonalBrainSearchResult } from "./personal-brain-search";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";

const NOW = new Date("2026-07-03T00:00:00Z");

function result(docScores: number[], factScores: number[] = []): PersonalBrainSearchResult {
  return {
    documents: docScores.map((score, i) => ({
      item: { id: `d${i}`, title: `Doc ${i}`, content: "Inhalt", category: "kitchen", updatedAt: NOW },
      score,
      matchMode: "keyword",
    })),
    facts: factScores.map((score, i) => ({
      item: { id: `f${i}`, title: `Fact ${i}`, content: "Fakt", factType: "note", updatedAt: NOW },
      score,
      matchMode: "keyword",
    })),
  };
}

describe("knowledge assistant (pure)", () => {
  it("assesses confidence from the top score", () => {
    assert.equal(assessConfidence(result([])), "none");
    assert.equal(assessConfidence(result([0.7])), "high");
    assert.equal(assessConfidence(result([0.4])), "medium");
    assert.equal(assessConfidence(result([0.25])), "low");
  });

  it("flags stale sources by age", () => {
    assert.equal(sourceAgeNote(new Date("2026-06-01"), NOW), null);
    assert.match(sourceAgeNote(new Date("2024-01-01"), NOW) ?? "", /älter/);
    assert.equal(sourceAgeNote(undefined, NOW), null);
  });

  it("builds citations sorted by score across docs and facts", () => {
    const citations = buildCitations(result([0.3], [0.9]), NOW);
    assert.equal(citations[0].kind, "fact");
    assert.equal(citations[0].score, 0.9);
    assert.equal(citations.length, 2);
  });

  it("produces a 'don't know' answer when nothing matches", () => {
    const answer = buildKnowledgeAnswer("was ist X", result([]), NOW);
    assert.equal(answer.confidence, "none");
    assert.match(answer.note, /weiß ich nicht sicher/);
    assert.equal(answer.citations.length, 0);
  });

  it("builds a grounded synthesis prompt with numbered sources", () => {
    const answer = buildKnowledgeAnswer("Gare?", result([0.9]), NOW);
    const prompt = buildSynthesisPrompt(answer.query, answer.citations);
    assert.match(prompt, /FRAGE: Gare\?/);
    assert.match(prompt, /\[1\] Doc 0/);
  });
});

describe("knowledge synthesis (graceful degradation)", () => {
  let db: ReturnType<typeof createPrismaClient>;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  after(async () => {
    await db.$disconnect();
  });

  it("returns no_sources without citations and rtx_offline without a local connector", async () => {
    const empty = buildKnowledgeAnswer("x", result([]), NOW);
    const noSources = await synthesizeKnowledgeAnswer(db, empty);
    assert.equal(noSources.status, "no_sources");

    const withSources = buildKnowledgeAnswer("x", result([0.9]), NOW);
    const offline = await synthesizeKnowledgeAnswer(db, withSources);
    // No llm_local connector registered in the test DB → clean offline state.
    assert.equal(offline.status, "rtx_offline");
  });
});

describe("knowledge assistant service (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    await db.personalBrainDocument.create({
      data: { title: "Brotrezept", content: "Sauerteig braucht 12 Stunden Gare bei Raumtemperatur.", category: "kitchen" },
    });
  });

  after(async () => {
    await db.$disconnect();
  });

  it("answers with a citation for a matching query and abstains otherwise", async () => {
    const service = createKnowledgeAssistantService(db);
    const hit = await service.ask("Sauerteig Gare", NOW);
    assert.notEqual(hit.confidence, "none");
    assert.ok(hit.citations.some((c) => c.title === "Brotrezept"));

    const miss = await service.ask("völlig anderes thema xyzq", NOW);
    assert.equal(miss.confidence, "none");
    assert.equal(miss.citations.length, 0);

    const empty = await service.ask("   ", NOW);
    assert.equal(empty.confidence, "none");
  });
});
