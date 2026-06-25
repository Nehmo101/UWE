import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requireAgentJobCallbackAuth } from "./agent-job-callback-auth";

function requestWithToken(token: string | null): Request {
  const headers = new Headers();
  if (token != null) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return new Request("http://localhost:3000/api/agent-jobs/callback", {
    method: "POST",
    headers,
  });
}

describe("requireAgentJobCallbackAuth", () => {
  it("rejects when STUDIO_API_TOKEN is not configured", () => {
    delete process.env.STUDIO_API_TOKEN;
    const response = requireAgentJobCallbackAuth(requestWithToken("anything"));
    assert.ok(response);
    assert.equal(response.status, 503);
  });

  it("accepts a valid bearer token", () => {
    process.env.STUDIO_API_TOKEN = "test-token-123";
    const response = requireAgentJobCallbackAuth(requestWithToken("test-token-123"));
    assert.equal(response, null);
  });

  it("rejects an invalid bearer token", () => {
    process.env.STUDIO_API_TOKEN = "test-token-123";
    const response = requireAgentJobCallbackAuth(requestWithToken("wrong"));
    assert.ok(response);
    assert.equal(response.status, 401);
  });
});
