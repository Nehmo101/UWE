import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickWritebackMailbox } from "./imap-writeback";

describe("pickWritebackMailbox", () => {
  it("prefers the RFC 6154 special-use flag over folder names", () => {
    const entries = [
      { path: "Ablage", specialUse: "\\Archive" },
      { path: "Archive", specialUse: null },
    ];
    assert.equal(pickWritebackMailbox(entries, "archive"), "Ablage");
  });

  it("falls back to German and English folder names", () => {
    assert.equal(
      pickWritebackMailbox([{ path: "Papierkorb" }, { path: "INBOX" }], "trash"),
      "Papierkorb",
    );
    assert.equal(
      pickWritebackMailbox([{ path: "Deleted Items" }], "trash"),
      "Deleted Items",
    );
  });

  it("matches namespaced paths by leaf name (Gmail-style)", () => {
    assert.equal(
      pickWritebackMailbox([{ path: "INBOX.Archiv" }, { path: "INBOX.Sent" }], "archive"),
      "INBOX.Archiv",
    );
  });

  it("returns null when no candidate exists", () => {
    assert.equal(pickWritebackMailbox([{ path: "INBOX" }], "trash"), null);
    assert.equal(pickWritebackMailbox([], "archive"), null);
  });
});
