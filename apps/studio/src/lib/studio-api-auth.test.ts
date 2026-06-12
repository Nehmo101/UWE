import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { requireStudioApiAuth } from "./studio-api-auth";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://studio.local/api/backup", {
    method: "POST",
    headers,
  });
}

describe("studio API auth guard", () => {
  afterEach(() => {
    delete process.env.STUDIO_API_TOKEN;
  });

  it("allows same-origin browser requests", () => {
    const result = requireStudioApiAuth(
      makeRequest({ "sec-fetch-site": "same-origin", host: "studio.local" }),
    );
    assert.equal(result, null);
  });

  it("allows non-browser requests without a token configured", () => {
    const result = requireStudioApiAuth(makeRequest({ host: "studio.local" }));
    assert.equal(result, null);
  });

  it("blocks cross-site browser requests (CSRF)", () => {
    const result = requireStudioApiAuth(
      makeRequest({ "sec-fetch-site": "cross-site", host: "studio.local" }),
    );
    assert.ok(result);
    assert.equal(result.status, 403);
  });

  it("blocks requests with a foreign Origin header", () => {
    const result = requireStudioApiAuth(
      makeRequest({ origin: "http://evil.example", host: "studio.local" }),
    );
    assert.ok(result);
    assert.equal(result.status, 403);
  });

  it("allows requests whose Origin matches the host", () => {
    const result = requireStudioApiAuth(
      makeRequest({ origin: "http://studio.local", host: "studio.local" }),
    );
    assert.equal(result, null);
  });

  it("requires the bearer token for non-browser clients when configured", () => {
    process.env.STUDIO_API_TOKEN = "super-secret-token";

    const withoutToken = requireStudioApiAuth(makeRequest({ host: "studio.local" }));
    assert.ok(withoutToken);
    assert.equal(withoutToken.status, 401);

    const withWrongToken = requireStudioApiAuth(
      makeRequest({ host: "studio.local", authorization: "Bearer wrong" }),
    );
    assert.ok(withWrongToken);
    assert.equal(withWrongToken.status, 401);

    const withToken = requireStudioApiAuth(
      makeRequest({ host: "studio.local", authorization: "Bearer super-secret-token" }),
    );
    assert.equal(withToken, null);
  });

  it("keeps the Studio UI working when a token is configured", () => {
    process.env.STUDIO_API_TOKEN = "super-secret-token";

    const result = requireStudioApiAuth(
      makeRequest({ "sec-fetch-site": "same-origin", host: "studio.local" }),
    );
    assert.equal(result, null);
  });

  it("still blocks cross-site requests even with a valid token", () => {
    process.env.STUDIO_API_TOKEN = "super-secret-token";

    const result = requireStudioApiAuth(
      makeRequest({
        "sec-fetch-site": "cross-site",
        host: "studio.local",
        authorization: "Bearer super-secret-token",
      }),
    );
    assert.ok(result);
    assert.equal(result.status, 403);
  });
});
