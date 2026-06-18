import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getApiTokenPrefix,
  hasApiTokenScope,
  isApiTokenFormat,
  maskSecretValue,
  maskTokenForDisplay,
} from "./api-token";
import {
  generateApiTokenValue,
  hashApiToken,
  verifyApiTokenHash,
} from "./api-token-crypto";

describe("api-token", () => {
  it("generates uwe_ prefixed tokens", () => {
    const token = generateApiTokenValue();
    assert.ok(isApiTokenFormat(token));
    assert.ok(token.startsWith("uwe_"));
  });

  it("stores only hashed values", () => {
    const token = generateApiTokenValue();
    const hash = hashApiToken(token, { AUTH_SECRET: "test-secret" });
    assert.notEqual(hash, token);
    assert.ok(verifyApiTokenHash(token, hash, { AUTH_SECRET: "test-secret" }));
    assert.equal(verifyApiTokenHash("wrong", hash, { AUTH_SECRET: "test-secret" }), false);
  });

  it("enforces scope checks", () => {
    assert.ok(hasApiTokenScope(["admin_read", "health_read"], "health_read"));
    assert.equal(hasApiTokenScope(["health_read"], "admin_write"), false);
  });

  it("masks secrets for display", () => {
    const token = "uwe_abcdef123456";
    assert.equal(maskTokenForDisplay(getApiTokenPrefix(token)), `${getApiTokenPrefix(token)}••••••••`);
    assert.equal(maskSecretValue("supersecret"), "supe…");
  });
});
