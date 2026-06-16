import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { requireRestoreOwnerAuth, requireStudioApiAuth } from "./studio-api-auth";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://studio.local/api/backup", {
    method: "POST",
    headers,
  });
}

describe("studio API auth guard", () => {
  afterEach(() => {
    delete process.env.STUDIO_API_TOKEN;
    delete process.env.AUTH_REQUIRED;
  });

  it("allows same-origin browser requests", async () => {
    const result = await requireStudioApiAuth(
      makeRequest({ "sec-fetch-site": "same-origin", host: "studio.local" }),
    );
    assert.equal(result, null);
  });

  it("allows non-browser requests without a token configured", async () => {
    const result = await requireStudioApiAuth(makeRequest({ host: "studio.local" }));
    assert.equal(result, null);
  });

  it("blocks cross-site browser requests (CSRF)", async () => {
    const result = await requireStudioApiAuth(
      makeRequest({ "sec-fetch-site": "cross-site", host: "studio.local" }),
    );
    assert.ok(result);
    assert.equal(result.status, 403);
  });

  it("blocks requests with a foreign Origin header", async () => {
    const result = await requireStudioApiAuth(
      makeRequest({ origin: "http://evil.example", host: "studio.local" }),
    );
    assert.ok(result);
    assert.equal(result.status, 403);
  });

  it("allows requests whose Origin matches the host", async () => {
    const result = await requireStudioApiAuth(
      makeRequest({ origin: "http://studio.local", host: "studio.local" }),
    );
    assert.equal(result, null);
  });

  it("requires the bearer token for non-browser clients when configured", async () => {
    process.env.STUDIO_API_TOKEN = "super-secret-token";

    const withoutToken = await requireStudioApiAuth(makeRequest({ host: "studio.local" }));
    assert.ok(withoutToken);
    assert.equal(withoutToken.status, 401);

    const withWrongToken = await requireStudioApiAuth(
      makeRequest({ host: "studio.local", authorization: "Bearer wrong" }),
    );
    assert.ok(withWrongToken);
    assert.equal(withWrongToken.status, 401);

    const withToken = await requireStudioApiAuth(
      makeRequest({ host: "studio.local", authorization: "Bearer super-secret-token" }),
    );
    assert.equal(withToken, null);
  });

  it("keeps the Studio UI working when a token is configured", async () => {
    process.env.STUDIO_API_TOKEN = "super-secret-token";

    const result = await requireStudioApiAuth(
      makeRequest({ "sec-fetch-site": "same-origin", host: "studio.local" }),
    );
    assert.equal(result, null);
  });

  it("still blocks cross-site requests even with a valid token", async () => {
    process.env.STUDIO_API_TOKEN = "super-secret-token";

    const result = await requireStudioApiAuth(
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

describe("restore owner auth guard", () => {
  afterEach(() => {
    delete process.env.STUDIO_API_TOKEN;
    delete process.env.RESTORE_OWNER_TOKEN;
  });

  it("allows same-origin restore without owner token configured", () => {
    const result = requireRestoreOwnerAuth(
      makeRequest({ "sec-fetch-site": "same-origin", host: "studio.local" }),
    );
    assert.equal(result, null);
  });

  it("requires owner bearer token for remote clients when configured", () => {
    process.env.RESTORE_OWNER_TOKEN = "owner-only-token";

    const blocked = requireRestoreOwnerAuth(
      makeRequest({ host: "studio.local", authorization: "Bearer studio-token" }),
    );
    assert.ok(blocked);
    assert.equal(blocked.status, 403);

    const allowed = requireRestoreOwnerAuth(
      makeRequest({ host: "studio.local", authorization: "Bearer owner-only-token" }),
    );
    assert.equal(allowed, null);
  });
});
