import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTotpAuthUri,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from "./totp";

describe("totp", () => {
  it("generates and verifies a TOTP code", () => {
    const secret = generateTotpSecret();
    const counter = 1_700_000_000;
    const code = generateTotpCode(secret, counter);
    assert.match(code, /^\d{6}$/);
    assert.equal(
      verifyTotpCode(secret, code, { window: 0, nowMs: counter * 30_000 }),
      true,
    );
    assert.equal(
      verifyTotpCode(secret, "000000", { window: 0, nowMs: counter * 30_000 }),
      false,
    );
  });

  it("builds otpauth URIs", () => {
    const secret = generateTotpSecret();
    const uri = buildTotpAuthUri(secret, { issuer: "UWE", accountName: "dm@uwe.local" });
    assert.match(uri, /^otpauth:\/\/totp\//);
    assert.match(uri, new RegExp(`secret=${secret}`));
  });
});
