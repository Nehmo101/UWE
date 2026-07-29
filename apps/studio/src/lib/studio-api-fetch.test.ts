import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLoginRedirect } from "./studio-api-fetch";

describe("resolveLoginRedirect", () => {
  it("sends an admin page back to itself after sign-in", () => {
    assert.equal(
      resolveLoginRedirect("/admin/ai-gateway"),
      "/login?redirect=%2Fadmin%2Fai-gateway",
    );
  });

  it("keeps the query string", () => {
    assert.equal(
      resolveLoginRedirect("/admin/audit-log", "?page=3"),
      "/login?redirect=%2Fadmin%2Faudit-log%3Fpage%3D3",
    );
  });

  it("does not bounce pages that handle 401 themselves", () => {
    // /login answers 401 for a wrong password — redirecting would swallow that message
    // and loop the visitor back to the form.
    for (const pathname of ["/login", "/login/reset", "/logout", "/setup", "/maintenance"]) {
      assert.equal(resolveLoginRedirect(pathname), null, pathname);
    }
  });

  it("does not treat a prefix lookalike as self-handled", () => {
    assert.equal(
      resolveLoginRedirect("/logbook"),
      "/login?redirect=%2Flogbook",
    );
  });
});
