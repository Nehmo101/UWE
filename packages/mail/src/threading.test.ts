import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveThreadId, normalizeSubjectForThreading, parseMessageIdRefs } from "./threading";

describe("normalizeSubjectForThreading", () => {
  it("strips reply/forward prefixes and lowercases", () => {
    assert.equal(normalizeSubjectForThreading("Re: Fwd: Rechnung"), "rechnung");
    assert.equal(normalizeSubjectForThreading("AW: WG: Termin"), "termin");
    assert.equal(normalizeSubjectForThreading("Neue Nachricht"), "neue nachricht");
  });
});

describe("parseMessageIdRefs", () => {
  it("splits a References header into individual ids", () => {
    assert.deepEqual(parseMessageIdRefs("<a@x> <b@x>"), ["<a@x>", "<b@x>"]);
  });
  it("returns [] for null", () => {
    assert.deepEqual(parseMessageIdRefs(null), []);
  });
});

describe("resolveThreadId", () => {
  it("inherits the thread of a referenced ancestor", async () => {
    const threadId = await resolveThreadId(
      { messageId: "<reply@x>", inReplyTo: "<root@x>", references: "<root@x>", subject: "Re: Hi" },
      { threadIdByMessageId: (id) => (id === "<root@x>" ? "thread-root" : null) },
    );
    assert.equal(threadId, "thread-root");
  });

  it("prefers the most recent ancestor in References", async () => {
    const seen: string[] = [];
    const threadId = await resolveThreadId(
      { messageId: "<c@x>", inReplyTo: "<b@x>", references: "<a@x> <b@x>", subject: "Re: Hi" },
      {
        threadIdByMessageId: (id) => {
          seen.push(id);
          return id === "<b@x>" ? "thread-b" : null;
        },
      },
    );
    assert.equal(threadId, "thread-b");
    // <b@x> (direct parent) is checked before <a@x>.
    assert.equal(seen[0], "<b@x>");
  });

  it("starts a new thread from the message's own id when no ancestor is known", async () => {
    const threadId = await resolveThreadId(
      { messageId: "<solo@x>", inReplyTo: null, references: null, subject: "Hallo" },
      { threadIdByMessageId: () => null },
    );
    assert.equal(threadId, "<solo@x>");
  });

  it("falls back to a subject key when there is no Message-ID", async () => {
    const threadId = await resolveThreadId(
      { messageId: null, inReplyTo: null, references: null, subject: "Re: Angebot" },
      { threadIdByMessageId: () => null },
    );
    assert.equal(threadId, "subject:angebot");
  });
});
