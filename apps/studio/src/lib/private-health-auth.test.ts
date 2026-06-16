import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requirePrivateHealthAuth } from "./private-health-auth";

function requestWithToken(token: string | null): Request {
  const headers = new Headers();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return new Request("http://127.0.0.1:3000/api/health/private", { headers });
}

describe("private health auth", () => {
  it("rejects when STUDIO_API_TOKEN is unset", () => {
    const previous = process.env.STUDIO_API_TOKEN;
    delete process.env.STUDIO_API_TOKEN;

    const response = requirePrivateHealthAuth(requestWithToken("anything"));
    assert.ok(response);
    assert.equal(response.status, 503);

    if (previous) {
      process.env.STUDIO_API_TOKEN = previous;
    }
  });

  it("accepts a valid bearer token", () => {
    process.env.STUDIO_API_TOKEN = "test-token-123";
    const response = requirePrivateHealthAuth(requestWithToken("test-token-123"));
    assert.equal(response, null);
  });

  it("rejects invalid bearer token", () => {
    process.env.STUDIO_API_TOKEN = "test-token-123";
    const response = requirePrivateHealthAuth(requestWithToken("wrong"));
    assert.ok(response);
    assert.equal(response.status, 401);
  });
});
