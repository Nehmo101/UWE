import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyNoteSyncOperations, type PlayerNoteSyncTarget } from "./note-sync";
import type { OfflineNoteOperation } from "./offline-queue";
import type { PlayerNoteLike } from "./offline-snapshot";

const BASE = "2026-08-02T10:00:00.000Z";

function serverNote(overrides: Partial<PlayerNoteLike> = {}): PlayerNoteLike {
  return {
    id: "n1",
    campaignId: "c1",
    pageId: null,
    gameSessionId: null,
    userId: "u1",
    authorDisplayName: "Anna",
    content: "Serverstand",
    visibility: "private",
    status: "draft",
    pageTitle: null,
    pageSlug: null,
    sessionTitle: null,
    sessionNumber: null,
    createdAt: new Date(BASE),
    updatedAt: new Date(BASE),
    ...overrides,
  };
}

interface Recorder {
  created: unknown[];
  updated: unknown[];
}

function target(
  overrides: Partial<PlayerNoteSyncTarget<string>> = {},
): { target: PlayerNoteSyncTarget<string>; log: Recorder } {
  const log: Recorder = { created: [], updated: [] };

  const base: PlayerNoteSyncTarget<string> = {
    async createPlayerNoteForViewer(_world, _ctx, input) {
      log.created.push(input);
      return serverNote({ id: "neu", content: input.content });
    },
    async getPlayerNoteForViewer() {
      return serverNote();
    },
    async updatePlayerNoteForViewer(_world, noteId, _ctx, content) {
      log.updated.push({ noteId, content });
      return serverNote({ id: noteId, content });
    },
  };

  return { target: { ...base, ...overrides }, log };
}

function create(clientRef: string, content: string): OfflineNoteOperation {
  return {
    op: "create",
    clientRef,
    campaignId: "c1",
    content,
    pageId: null,
    gameSessionId: null,
    clientUpdatedAt: "2026-08-02T12:00:00.000Z",
  };
}

function update(clientRef: string, base: string | null): OfflineNoteOperation {
  return {
    op: "update",
    clientRef,
    campaignId: "c1",
    noteId: "n1",
    content: "meine Fassung",
    baseUpdatedAt: base,
    clientUpdatedAt: "2026-08-02T12:00:00.000Z",
  };
}

describe("applyNoteSyncOperations", () => {
  it("legt eine Notiz an und reicht die Offline-Kennung durch", async () => {
    const { target: sync, log } = target();

    const results = await applyNoteSyncOperations({
      target: sync,
      worldSlug: "eryn",
      ctx: "ctx",
      viewerUserId: "u1",
      operations: [create("a", "am Tisch getippt")],
    });

    assert.equal(results[0].status, "applied");
    assert.equal(results[0].note?.content, "am Tisch getippt");
    assert.deepEqual((log.created[0] as { clientRef: string }).clientRef, "a");
  });

  it("wendet eine Aenderung an, wenn der Serverstand unveraendert ist", async () => {
    const { target: sync, log } = target();

    const results = await applyNoteSyncOperations({
      target: sync,
      worldSlug: "eryn",
      ctx: "ctx",
      viewerUserId: "u1",
      operations: [update("b", BASE)],
    });

    assert.equal(results[0].status, "applied");
    assert.equal(log.updated.length, 1);
  });

  it("meldet Konflikt statt zu ueberschreiben, wenn die Notiz weitergewandert ist", async () => {
    const { target: sync, log } = target({
      async getPlayerNoteForViewer() {
        return serverNote({
          content: "fremde Fassung",
          updatedAt: new Date("2026-08-02T11:00:00.000Z"),
        });
      },
    });

    const results = await applyNoteSyncOperations({
      target: sync,
      worldSlug: "eryn",
      ctx: "ctx",
      viewerUserId: "u1",
      operations: [update("b", BASE)],
    });

    assert.equal(results[0].status, "conflict");
    assert.equal(results[0].note?.content, "fremde Fassung");
    assert.equal(log.updated.length, 0, "es wird nichts geschrieben");
  });

  it("behandelt einen Edit ohne bekannten Ausgangsstand als Konflikt", async () => {
    const { target: sync } = target();

    const results = await applyNoteSyncOperations({
      target: sync,
      worldSlug: "eryn",
      ctx: "ctx",
      viewerUserId: "u1",
      operations: [update("b", null)],
    });

    assert.equal(results[0].status, "conflict");
  });

  it("lehnt ab, was der Guard ablehnt — beim Anlegen wie beim Aendern", async () => {
    const { target: sync } = target({
      async createPlayerNoteForViewer() {
        return null;
      },
      async updatePlayerNoteForViewer() {
        return null;
      },
    });

    const results = await applyNoteSyncOperations({
      target: sync,
      worldSlug: "eryn",
      ctx: "ctx",
      viewerUserId: "u1",
      operations: [create("a", "verboten"), update("b", BASE)],
    });

    assert.deepEqual(
      results.map((result) => result.status),
      ["denied", "denied"],
    );
  });

  it("lehnt eine Aenderung an einer unsichtbaren Notiz ab", async () => {
    const { target: sync } = target({
      async getPlayerNoteForViewer() {
        return null;
      },
    });

    const results = await applyNoteSyncOperations({
      target: sync,
      worldSlug: "eryn",
      ctx: "ctx",
      viewerUserId: "u1",
      operations: [update("b", BASE)],
    });

    assert.equal(results[0].status, "denied");
  });

  it("beantwortet jeden Eintrag, damit die Warteschlange leerlaufen kann", async () => {
    const { target: sync } = target();

    const operations = [create("a", "eins"), create("b", "zwei"), update("c", BASE)];
    const results = await applyNoteSyncOperations({
      target: sync,
      worldSlug: "eryn",
      ctx: "ctx",
      viewerUserId: "u1",
      operations,
    });

    assert.deepEqual(
      results.map((result) => result.clientRef),
      ["a", "b", "c"],
    );
  });
});
