import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLikelyGameSessionId, isWikiSessionCategoryPath } from "./session-route";

describe("session route helpers", () => {
  it("detects Prisma cuid game session ids", () => {
    assert.equal(isLikelyGameSessionId("clxyz1234567890abcdefghij"), true);
    assert.equal(isLikelyGameSessionId("2025-01-14-session-ftkj"), false);
    assert.equal(isLikelyGameSessionId("session-1-recap"), false);
  });

  it("treats human slugs under /sessions/ as wiki pages", () => {
    assert.equal(isWikiSessionCategoryPath("sessions", "2025-01-14-session-ftkj"), true);
    assert.equal(isWikiSessionCategoryPath("sessions", "clxyz1234567890abcdefghij"), false);
    assert.equal(isWikiSessionCategoryPath("orte", "2025-01-14-session-ftkj"), false);
  });
});
