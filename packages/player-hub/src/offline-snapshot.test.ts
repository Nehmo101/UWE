import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPortalOfflineSnapshot,
  isUsablePortalOfflineSnapshot,
  PORTAL_OFFLINE_SNAPSHOT_VERSION,
  type BuildPortalOfflineSnapshotInput,
} from "./offline-snapshot";

type RawNote = BuildPortalOfflineSnapshotInput["notes"][number];

function rawNote(overrides: Partial<RawNote> = {}): RawNote {
  return {
    id: "n1",
    campaignId: "c1",
    pageId: null,
    gameSessionId: null,
    userId: "u1",
    authorDisplayName: "Anna",
    content: "Notiz",
    visibility: "private",
    status: "draft",
    pageTitle: null,
    pageSlug: null,
    sessionTitle: null,
    sessionNumber: null,
    createdAt: new Date("2026-08-02T10:00:00.000Z"),
    updatedAt: new Date("2026-08-02T10:00:00.000Z"),
    ...overrides,
  };
}

function input(
  overrides: Partial<BuildPortalOfflineSnapshotInput> = {},
): BuildPortalOfflineSnapshotInput {
  return {
    snapshotAt: new Date("2026-08-02T12:00:00.000Z"),
    world: { slug: "eryn", name: "Eryn" },
    campaignId: "c1",
    viewerUserId: "u1",
    characters: [],
    notes: [],
    treasury: null,
    ...overrides,
  };
}

describe("buildPortalOfflineSnapshot", () => {
  it("serialisiert Zeitstempel, weil der Abzug als JSON reist", () => {
    const snapshot = buildPortalOfflineSnapshot(input({ notes: [rawNote()] }));

    assert.equal(snapshot.snapshotAt, "2026-08-02T12:00:00.000Z");
    assert.equal(snapshot.notes[0].updatedAt, "2026-08-02T10:00:00.000Z");
    assert.equal(snapshot.version, PORTAL_OFFLINE_SNAPSHOT_VERSION);
  });

  it("markiert eigene Notizen — nur die sind offline bearbeitbar", () => {
    const snapshot = buildPortalOfflineSnapshot(
      input({
        notes: [rawNote({ id: "eigen" }), rawNote({ id: "fremd", userId: "u2" })],
      }),
    );

    const own = new Map(snapshot.notes.map((note) => [note.id, note.own]));
    assert.equal(own.get("eigen"), true);
    assert.equal(own.get("fremd"), false);
  });

  it("sortiert die neueste Notiz nach oben", () => {
    const snapshot = buildPortalOfflineSnapshot(
      input({
        notes: [
          rawNote({ id: "alt", updatedAt: new Date("2026-08-01T10:00:00.000Z") }),
          rawNote({ id: "neu", updatedAt: new Date("2026-08-02T11:00:00.000Z") }),
        ],
      }),
    );

    assert.deepEqual(
      snapshot.notes.map((note) => note.id),
      ["neu", "alt"],
    );
  });

  it("kennt ohne angemeldeten Nutzer keine eigenen Notizen", () => {
    const snapshot = buildPortalOfflineSnapshot(
      input({ viewerUserId: null, notes: [rawNote()] }),
    );

    assert.equal(snapshot.notes[0].own, false);
  });
});

describe("isUsablePortalOfflineSnapshot", () => {
  it("nimmt einen frisch gebauten Abzug an", () => {
    assert.equal(isUsablePortalOfflineSnapshot(buildPortalOfflineSnapshot(input())), true);
  });

  it("verwirft einen Abzug aus einer aelteren Fassung", () => {
    const stale = { ...buildPortalOfflineSnapshot(input()), version: 0 };

    assert.equal(isUsablePortalOfflineSnapshot(stale), false);
  });

  it("verwirft Unsinn statt daran zu scheitern", () => {
    assert.equal(isUsablePortalOfflineSnapshot(null), false);
    assert.equal(isUsablePortalOfflineSnapshot("nope"), false);
    assert.equal(isUsablePortalOfflineSnapshot({}), false);
  });
});
