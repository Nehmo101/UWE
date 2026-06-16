import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  checkStudioAccess,
  studioAccessContextFromHeaders,
  studioAccessErrorMessage,
} from "./studio-access";

function ctx(headers: Record<string, string>) {
  return studioAccessContextFromHeaders(new Headers(headers));
}

describe("studio access guard", () => {
  afterEach(() => {
    delete process.env.STUDIO_API_TOKEN;
  });

  it("allows same-origin browser requests", () => {
    const result = checkStudioAccess(
      ctx({ "sec-fetch-site": "same-origin", host: "studio.local" }),
    );
    assert.equal(result.allowed, true);
  });

  it("allows non-browser requests without a token configured", () => {
    const result = checkStudioAccess(ctx({ host: "studio.local" }));
    assert.equal(result.allowed, true);
  });

  it("blocks cross-site browser requests (CSRF)", () => {
    const result = checkStudioAccess(
      ctx({ "sec-fetch-site": "cross-site", host: "studio.local" }),
    );
    assert.equal(result.allowed, false);
    assert.equal(result.denial, "csrf");
    assert.equal(result.httpStatus, 403);
  });

  it("blocks requests with a foreign Origin header", () => {
    const result = checkStudioAccess(
      ctx({ origin: "http://evil.example", host: "studio.local" }),
    );
    assert.equal(result.allowed, false);
    assert.equal(result.denial, "csrf");
  });

  it("requires bearer token for non-browser clients when configured", () => {
    process.env.STUDIO_API_TOKEN = "super-secret-token";

    const withoutToken = checkStudioAccess(ctx({ host: "studio.local" }));
    assert.equal(withoutToken.allowed, false);
    assert.equal(withoutToken.denial, "token_required");

    const withWrongToken = checkStudioAccess(
      ctx({ host: "studio.local", authorization: "Bearer wrong" }),
    );
    assert.equal(withWrongToken.allowed, false);
    assert.equal(withWrongToken.denial, "invalid_token");

    const withToken = checkStudioAccess(
      ctx({ host: "studio.local", authorization: "Bearer super-secret-token" }),
    );
    assert.equal(withToken.allowed, true);
  });

  it("keeps the Studio UI working when a token is configured", () => {
    process.env.STUDIO_API_TOKEN = "super-secret-token";

    const result = checkStudioAccess(
      ctx({ "sec-fetch-site": "same-origin", host: "studio.local" }),
    );
    assert.equal(result.allowed, true);
  });

  it("still blocks cross-site requests even with a valid token", () => {
    process.env.STUDIO_API_TOKEN = "super-secret-token";

    const result = checkStudioAccess(
      ctx({
        "sec-fetch-site": "cross-site",
        host: "studio.local",
        authorization: "Bearer super-secret-token",
      }),
    );
    assert.equal(result.allowed, false);
    assert.equal(result.denial, "csrf");
  });

  it("returns German error messages", () => {
    assert.match(studioAccessErrorMessage("csrf"), /Cross-Origin/);
    assert.match(studioAccessErrorMessage("token_required"), /Bearer/);
  });
});
