import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encryptSecret, decryptSecret } from "./token-crypto";

describe("token crypto", () => {
  it("encrypts and decrypts secrets", () => {
    const encrypted = encryptSecret("refresh-token-value", "secret-key");
    assert.notEqual(encrypted, "refresh-token-value");

    const decrypted = decryptSecret(encrypted, "secret-key");
    assert.equal(decrypted, "refresh-token-value");
  });
});
