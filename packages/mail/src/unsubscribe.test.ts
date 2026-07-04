import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseListUnsubscribeHeader,
  parseMailtoTarget,
  supportsOneClickUnsubscribe,
} from "./unsubscribe";

describe("mail unsubscribe", () => {
  it("parses http and mailto targets from a combined header", () => {
    const parsed = parseListUnsubscribeHeader(
      "<https://example.com/unsub?id=123>, <mailto:unsub@example.com?subject=unsubscribe>",
    );
    assert.equal(parsed.httpUrl, "https://example.com/unsub?id=123");
    assert.equal(parsed.mailto, "mailto:unsub@example.com?subject=unsubscribe");
  });

  it("returns nulls for a missing header", () => {
    const parsed = parseListUnsubscribeHeader(null);
    assert.equal(parsed.httpUrl, null);
    assert.equal(parsed.mailto, null);
  });

  it("detects RFC 8058 one-click support", () => {
    assert.equal(supportsOneClickUnsubscribe("List-Unsubscribe=One-Click"), true);
    assert.equal(supportsOneClickUnsubscribe(null), false);
    assert.equal(supportsOneClickUnsubscribe("something-else"), false);
  });

  it("splits a mailto target into recipient, subject and body", () => {
    const target = parseMailtoTarget("mailto:unsub@example.com?subject=unsubscribe%20me&body=please");
    assert.equal(target.to, "unsub@example.com");
    assert.equal(target.subject, "unsubscribe me");
    assert.equal(target.body, "please");
  });

  it("splits a bare mailto target without query params", () => {
    const target = parseMailtoTarget("mailto:unsub@example.com");
    assert.equal(target.to, "unsub@example.com");
    assert.equal(target.subject, null);
    assert.equal(target.body, null);
  });
});
