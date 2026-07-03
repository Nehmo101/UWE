import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  buildRecapDraft,
  buildSessionReviewDraft,
  createSessionLiveService,
  sessionLiveKindLabel,
  type SessionLiveEntryRecord,
} from "./session-live-service";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

function entry(overrides: Partial<SessionLiveEntryRecord>): SessionLiveEntryRecord {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    gameSessionId: "gs1",
    kind: "note",
    content: "…",
    refPageId: null,
    payload: null,
    createdAt: overrides.createdAt ?? new Date("2026-07-03T20:00:00Z"),
    ...overrides,
  };
}

describe("session-live review draft (pure)", () => {
  it("groups entries by kind and counts the total", () => {
    const draft = buildSessionReviewDraft([
      entry({ kind: "note", content: "Intro" }),
      entry({ kind: "loot", content: "+1 Schwert" }),
      entry({ kind: "quest_update", content: "Suche erledigt" }),
      entry({ kind: "npc_update", content: "Grimm ist tot" }),
      entry({ kind: "initiative", content: "Runde 1" }),
      entry({ kind: "bookmark", content: "Hier weiter" }),
    ]);

    assert.equal(draft.total, 6);
    assert.equal(draft.notes.length, 1);
    assert.equal(draft.loot.length, 1);
    assert.equal(draft.questUpdates.length, 1);
    assert.equal(draft.npcUpdates.length, 1);
    assert.equal(draft.initiative.length, 1);
    assert.equal(draft.bookmarks.length, 1);
  });

  it("treats unknown/note kinds as notes", () => {
    const draft = buildSessionReviewDraft([entry({ kind: "note", content: "a" })]);
    assert.equal(draft.notes.length, 1);
  });

  it("handles an empty entry list", () => {
    const draft = buildSessionReviewDraft([]);
    assert.equal(draft.total, 0);
    assert.equal(draft.loot.length, 0);
  });

  it("labels every kind in German", () => {
    assert.equal(sessionLiveKindLabel("loot"), "Beute");
    assert.equal(sessionLiveKindLabel("quest_update"), "Quest-Update");
  });
});

describe("session-live recap draft (pure)", () => {
  it("builds a markdown recap grouped into sections, skipping empty ones", () => {
    const recap = buildRecapDraft([
      entry({ kind: "note", content: "Die Gruppe betrat die Stadt." }),
      entry({ kind: "loot", content: "Goldbeutel gefunden" }),
      entry({ kind: "initiative", content: "   " }), // blank → skipped
    ]);

    assert.match(recap, /## Verlauf/);
    assert.match(recap, /Die Gruppe betrat die Stadt\./);
    assert.match(recap, /## Beute/);
    assert.doesNotMatch(recap, /Initiative/);
  });

  it("returns an empty string when there are no entries", () => {
    assert.equal(buildRecapDraft([]), "");
  });
});

describe("session-live service (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;
  let gameSessionId: string;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    const world = await createUweRepository(databaseUrl).createWorld({
      name: "Live Test",
      slug: "live-test",
    });
    const session = await db.gameSession.create({
      data: { worldId: world.id, title: "Session 1", sessionNumber: 1 },
    });
    gameSessionId = session.id;
  });

  after(async () => {
    await db.$disconnect();
  });

  it("appends, lists in order, and deletes entries", async () => {
    const service = createSessionLiveService(db);

    await service.appendEntry({ gameSessionId, kind: "note", content: "Erster Eintrag" });
    const loot = await service.appendEntry({
      gameSessionId,
      kind: "loot",
      content: "+1 Trank",
      payload: { gp: 5 },
    });

    const entries = await service.listEntries(gameSessionId);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].content, "Erster Eintrag");
    assert.deepEqual(entries[1].payload, { gp: 5 });

    const draft = await service.getReviewDraft(gameSessionId);
    assert.equal(draft.loot.length, 1);
    assert.equal(draft.notes.length, 1);

    await service.deleteEntry(loot.id);
    assert.equal((await service.listEntries(gameSessionId)).length, 1);
  });
});
