import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPortalLoginUrl,
  portalReturnPath,
  sanitizePortalRedirectPath,
} from "./portal-redirect";

describe("portal-redirect", () => {
  it("allows same-origin relative paths", () => {
    assert.equal(
      sanitizePortalRedirectPath("/auth/worlds/terra/wiki"),
      "/auth/worlds/terra/wiki",
    );
    assert.equal(
      sanitizePortalRedirectPath("/auth/worlds/terra?q=dragon"),
      "/auth/worlds/terra?q=dragon",
    );
  });

  it("rejects open redirects", () => {
    assert.equal(sanitizePortalRedirectPath("https://evil.example"), "/auth/worlds");
    assert.equal(sanitizePortalRedirectPath("//evil.example"), "/auth/worlds");
    assert.equal(sanitizePortalRedirectPath("javascript:alert(1)"), "/auth/worlds");
  });

  it("falls back for empty values", () => {
    assert.equal(sanitizePortalRedirectPath(null), "/auth/worlds");
    assert.equal(sanitizePortalRedirectPath("   "), "/auth/worlds");
    assert.equal(sanitizePortalRedirectPath(undefined, "/portal"), "/portal");
  });

  it("builds login URLs with encoded redirect", () => {
    assert.equal(
      buildPortalLoginUrl("/auth/worlds/terra?q=test"),
      "/login?redirect=%2Fauth%2Fworlds%2Fterra%3Fq%3Dtest",
    );
  });

  it("combines pathname and search for middleware return paths", () => {
    assert.equal(portalReturnPath("/auth/worlds/terra", "?tab=wiki"), "/auth/worlds/terra?tab=wiki");
  });
});
