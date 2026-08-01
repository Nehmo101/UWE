import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SESSION_BOOKMARK_KIND,
  encodeBookmarkPayload,
  latestBookmark,
  parseBookmarkPayload,
} from "./bookmark";

describe("encodeBookmarkPayload / parseBookmarkPayload", () => {
  it("round-trips a bookmark", () => {
    const payload = encodeBookmarkPayload({
      pageId: "page-1",
      anchor: "die-nacht",
      scrollRatio: 0.42,
    });

    assert.deepEqual(parseBookmarkPayload(payload), {
      pageId: "page-1",
      anchor: "die-nacht",
      scrollRatio: 0.42,
    });
  });

  it("prefers the refPageId column over the payload", () => {
    const bookmark = parseBookmarkPayload({ pageId: "aus-dem-payload" }, "aus-der-spalte");
    assert.equal(bookmark?.pageId, "aus-der-spalte");
  });

  it("returns null without any page reference", () => {
    assert.equal(parseBookmarkPayload({ anchor: "x" }), null);
    assert.equal(parseBookmarkPayload(null), null);
    assert.equal(parseBookmarkPayload("kaputt"), null);
  });

  it("clamps a scroll ratio into 0…1 and drops nonsense", () => {
    assert.equal(parseBookmarkPayload({ pageId: "p", scrollRatio: 2 })?.scrollRatio, 1);
    assert.equal(parseBookmarkPayload({ pageId: "p", scrollRatio: -1 })?.scrollRatio, 0);
    assert.equal(parseBookmarkPayload({ pageId: "p", scrollRatio: "halb" })?.scrollRatio, null);
  });
});

describe("latestBookmark", () => {
  it("takes the newest bookmark and ignores other entry kinds", () => {
    const bookmark = latestBookmark([
      {
        kind: "note",
        refPageId: "note-page",
        payload: {},
        createdAt: new Date("2026-08-01T22:00:00Z"),
      },
      {
        kind: SESSION_BOOKMARK_KIND,
        refPageId: "alt",
        payload: { anchor: "a" },
        createdAt: new Date("2026-08-01T20:00:00Z"),
      },
      {
        kind: SESSION_BOOKMARK_KIND,
        refPageId: "neu",
        payload: { anchor: "b" },
        createdAt: new Date("2026-08-01T21:00:00Z"),
      },
    ]);

    assert.equal(bookmark?.pageId, "neu");
    assert.equal(bookmark?.anchor, "b");
  });

  it("skips a bookmark without a page and falls back to the next one", () => {
    const bookmark = latestBookmark([
      {
        kind: SESSION_BOOKMARK_KIND,
        refPageId: null,
        payload: {},
        createdAt: new Date("2026-08-01T21:00:00Z"),
      },
      {
        kind: SESSION_BOOKMARK_KIND,
        refPageId: "brauchbar",
        payload: {},
        createdAt: new Date("2026-08-01T20:00:00Z"),
      },
    ]);

    assert.equal(bookmark?.pageId, "brauchbar");
  });

  it("returns null when there is nothing to resume", () => {
    assert.equal(latestBookmark([]), null);
  });
});
