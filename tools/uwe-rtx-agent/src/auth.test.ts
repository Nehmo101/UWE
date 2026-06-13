import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractToken, verifyToken } from "./auth.js";

function mockRequest(headers: Record<string, string>): import("node:http").IncomingMessage {
  return { headers } as import("node:http").IncomingMessage;
}

describe("auth", () => {
  it("accepts bearer token", () => {
    const request = mockRequest({ authorization: "Bearer secret-token" });
    assert.deepEqual(verifyToken(request, "secret-token"), { ok: true });
  });

  it("accepts x-agent-token header", () => {
    const request = mockRequest({ "x-agent-token": "secret-token" });
    assert.deepEqual(verifyToken(request, "secret-token"), { ok: true });
  });

  it("rejects missing token", () => {
    const request = mockRequest({});
    assert.deepEqual(verifyToken(request, "secret-token"), { ok: false, reason: "missing" });
  });

  it("rejects invalid token", () => {
    const request = mockRequest({ authorization: "Bearer wrong-token" });
    assert.deepEqual(verifyToken(request, "secret-token"), { ok: false, reason: "invalid" });
  });

  it("extracts token without logging sensitive values", () => {
    assert.equal(extractToken(mockRequest({ "x-agent-token": "abc" })), "abc");
    assert.equal(extractToken(mockRequest({ authorization: "Bearer xyz" })), "xyz");
  });
});
