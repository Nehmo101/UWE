import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collapseNoteQueue,
  mergeNotesWithQueue,
  reconcileNoteQueue,
  type OfflineNoteOperation,
  type OfflineSyncResult,
} from "./offline-queue";
import type { PortalOfflineNote } from "./offline-snapshot";

function create(clientRef: string, content: string, at: string): OfflineNoteOperation {
  return {
    op: "create",
    clientRef,
    campaignId: "c1",
    content,
    pageId: null,
    gameSessionId: null,
    clientUpdatedAt: at,
  };
}

function update(
  clientRef: string,
  noteId: string,
  content: string,
  at: string,
): OfflineNoteOperation {
  return {
    op: "update",
    clientRef,
    campaignId: "c1",
    noteId,
    content,
    baseUpdatedAt: "2026-08-02T10:00:00.000Z",
    clientUpdatedAt: at,
  };
}

function note(overrides: Partial<PortalOfflineNote> = {}): PortalOfflineNote {
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
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-02T10:00:00.000Z",
    own: true,
    ...overrides,
  };
}

describe("collapseNoteQueue", () => {
  it("behaelt je Kennung nur den neuesten Stand", () => {
    const collapsed = collapseNoteQueue([
      create("a", "erste Fassung", "2026-08-02T12:00:00.000Z"),
      create("a", "zweite Fassung", "2026-08-02T12:05:00.000Z"),
    ]);

    assert.equal(collapsed.length, 1);
    assert.equal(collapsed[0].content, "zweite Fassung");
  });

  it("laesst ein create ein create bleiben, auch nach Nachbesserung", () => {
    const collapsed = collapseNoteQueue([
      create("a", "erste", "2026-08-02T12:00:00.000Z"),
      update("a", "n1", "nachgebessert", "2026-08-02T12:10:00.000Z"),
    ]);

    assert.equal(collapsed[0].op, "create");
    assert.equal(collapsed[0].content, "nachgebessert");
  });

  it("ignoriert einen aelteren Nachzuegler", () => {
    const collapsed = collapseNoteQueue([
      create("a", "neu", "2026-08-02T12:10:00.000Z"),
      create("a", "alt", "2026-08-02T12:00:00.000Z"),
    ]);

    assert.equal(collapsed[0].content, "neu");
  });

  it("haelt verschiedene Kennungen auseinander und sortiert nach Zeit", () => {
    const collapsed = collapseNoteQueue([
      create("b", "zweite", "2026-08-02T12:10:00.000Z"),
      create("a", "erste", "2026-08-02T12:00:00.000Z"),
    ]);

    assert.deepEqual(
      collapsed.map((operation) => operation.clientRef),
      ["a", "b"],
    );
  });
});

describe("reconcileNoteQueue", () => {
  const queue = [
    create("a", "angekommen", "2026-08-02T12:00:00.000Z"),
    update("b", "n1", "meine Fassung", "2026-08-02T12:01:00.000Z"),
    create("c", "abgelehnt", "2026-08-02T12:02:00.000Z"),
  ];

  const results: OfflineSyncResult[] = [
    { clientRef: "a", status: "applied", note: note({ id: "n9" }) },
    { clientRef: "b", status: "conflict", note: note({ content: "fremde Fassung" }) },
    { clientRef: "c", status: "denied", reason: "Keine Berechtigung" },
  ];

  it("raeumt Erledigtes ab und rettet die Fassung aus dem Konflikt", () => {
    const outcome = reconcileNoteQueue(queue, results, (_operation, index) => `rescue-${index}`);

    assert.equal(outcome.applied.length, 1);
    assert.equal(outcome.denied.length, 1);
    assert.equal(outcome.conflicts.length, 1);
    assert.equal(outcome.queue.length, 1);

    const rescued = outcome.queue[0];
    assert.equal(rescued.op, "create", "die lokale Fassung wird zur neuen Notiz");
    assert.equal(rescued.content, "meine Fassung");
    assert.equal(rescued.clientRef, "rescue-1");
  });

  it("behaelt Eintraege ohne Antwort fuer den naechsten Versuch", () => {
    const outcome = reconcileNoteQueue(queue, [results[0]], () => "x");

    assert.deepEqual(
      outcome.queue.map((operation) => operation.clientRef),
      ["b", "c"],
    );
  });

  it("verliert nichts, wenn der Server gar nicht antwortet", () => {
    const outcome = reconcileNoteQueue(queue, [], () => "x");

    assert.equal(outcome.queue.length, queue.length);
  });
});

describe("mergeNotesWithQueue", () => {
  const options = { viewerUserId: "u1", viewerDisplayName: "Anna" };

  it("zeigt Offline-Angelegtes sofort an", () => {
    const merged = mergeNotesWithQueue(
      [note()],
      [create("a", "am Tisch getippt", "2026-08-02T13:00:00.000Z")],
      options,
    );

    assert.equal(merged.length, 2);
    assert.equal(merged[0].content, "am Tisch getippt");
    assert.equal(merged[0].pending, true);
    assert.equal(merged[0].own, true);
  });

  it("legt eine wartende Aenderung ueber den Serverstand", () => {
    const merged = mergeNotesWithQueue(
      [note()],
      [update("b", "n1", "korrigiert", "2026-08-02T13:00:00.000Z")],
      options,
    );

    assert.equal(merged.length, 1);
    assert.equal(merged[0].content, "korrigiert");
    assert.equal(merged[0].pending, true);
    assert.equal(merged[0].clientRef, "b");
  });

  it("laesst unberuehrte Notizen unberuehrt", () => {
    const merged = mergeNotesWithQueue([note()], [], options);

    assert.equal(merged[0].content, "Serverstand");
    assert.equal(merged[0].pending, false);
    assert.equal(merged[0].clientRef, null);
  });
});
