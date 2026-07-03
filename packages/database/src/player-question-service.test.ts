import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  PLAYER_QUESTION_STATUS_LABELS,
  createPlayerQuestionService,
} from "./player-question-service";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

describe("player-question labels", () => {
  it("labels every status in German", () => {
    assert.equal(PLAYER_QUESTION_STATUS_LABELS.open, "Offen");
    assert.equal(PLAYER_QUESTION_STATUS_LABELS.answered, "Beantwortet");
    assert.equal(PLAYER_QUESTION_STATUS_LABELS.archived, "Archiviert");
  });
});

describe("player-question service (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;
  const worldSlug = "fragen-test";

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    await createUweRepository(databaseUrl).createWorld({
      name: "Fragen Test",
      slug: worldSlug,
    });
  });

  after(async () => {
    await db.$disconnect();
  });

  it("asks, lists newest-first, answers, and archives", async () => {
    const service = createPlayerQuestionService(db);

    const first = await service.ask({
      worldSlug,
      authorName: "Aria",
      question: "Wo finden wir den Schlüssel?",
    });
    assert.equal(first.status, "open");
    assert.equal(first.answer, null);
    assert.equal(first.answeredAt, null);
    assert.equal(first.authorName, "Aria");

    const second = await service.ask({
      worldSlug,
      authorName: "Borin",
      question: "Lebt der König noch?",
    });

    const all = await service.listForWorld(worldSlug);
    assert.equal(all.length, 2);
    // newest first
    assert.equal(all[0].id, second.id);
    assert.equal(all[1].id, first.id);

    assert.equal(await service.countOpenForWorld(worldSlug), 2);

    const answered = await service.answer(first.id, "Im alten Turm.");
    assert.equal(answered.status, "answered");
    assert.equal(answered.answer, "Im alten Turm.");
    assert.ok(answered.answeredAt instanceof Date);

    const open = await service.listForWorld(worldSlug, { status: "open" });
    assert.equal(open.length, 1);
    assert.equal(open[0].id, second.id);
    assert.equal(await service.countOpenForWorld(worldSlug), 1);

    const archived = await service.archive(second.id);
    assert.equal(archived.status, "archived");
    assert.equal(await service.countOpenForWorld(worldSlug), 0);

    const answeredList = await service.listForWorld(worldSlug, { status: "answered" });
    assert.equal(answeredList.length, 1);
    assert.equal(answeredList[0].id, first.id);
  });

  it("rejects empty questions and answers", async () => {
    const service = createPlayerQuestionService(db);
    await assert.rejects(
      () => service.ask({ worldSlug, authorName: "X", question: "   " }),
      /Frage darf nicht leer sein/,
    );

    const q = await service.ask({ worldSlug, authorName: "X", question: "Echte Frage?" });
    await assert.rejects(() => service.answer(q.id, "  "), /Antwort darf nicht leer sein/);
  });

  it("throws for an unknown world slug", async () => {
    const service = createPlayerQuestionService(db);
    await assert.rejects(
      () => service.ask({ worldSlug: "gibt-es-nicht", authorName: "X", question: "Hallo?" }),
      /Welt nicht gefunden/,
    );
  });
});
