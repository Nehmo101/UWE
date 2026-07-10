import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateTotpCode, verifyTotpCode } from "@uwe/auth/server";

const STEP_MS = 30_000;

// Base32-Encoding mit derselben RFC-4648-Alphabet-Reihenfolge, die das
// TOTP-Modul zum Dekodieren verwendet. Damit lässt sich der kanonische
// RFC-6238-ASCII-Seed in einen für generateTotpCode nutzbaren Secret-String
// überführen.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

describe("totp verification windows and RFC 6238 vectors", () => {
  it("matches the RFC 6238 SHA-1 test vector at T=59s", () => {
    // RFC 6238 Appendix B (SHA-1): Seed "12345678901234567890",
    // T=59s -> Zeitschritt 1 -> 8-stelliges TOTP 94287082,
    // auf 6 Stellen gekürzt -> 287082.
    const secret = base32Encode(Buffer.from("12345678901234567890", "ascii"));

    const code = generateTotpCode(secret, 1);
    assert.equal(code, "287082");

    // Gegenprobe über verifyTotpCode am selben Zeitpunkt (window 0).
    assert.equal(verifyTotpCode(secret, code, { window: 0, nowMs: 59_000 }), true);
  });

  it("accepts a code from an adjacent time step only within window 1", () => {
    const secret = base32Encode(Buffer.from("adjacent-step-secret", "ascii"));
    const counter = 1_700_000_000;
    const code = generateTotpCode(secret, counter);

    // Prüfzeitpunkt liegt einen Schritt nach der Code-Erzeugung.
    const nowNextStep = (counter + 1) * STEP_MS;

    assert.equal(verifyTotpCode(secret, code, { window: 1, nowMs: nowNextStep }), true);
    assert.equal(verifyTotpCode(secret, code, { window: 0, nowMs: nowNextStep }), false);
  });

  it("rejects a code two time steps away even with window 1", () => {
    const secret = base32Encode(Buffer.from("far-step-secret", "ascii"));
    const counter = 1_700_000_000;
    const code = generateTotpCode(secret, counter);

    const nowTwoStepsLater = (counter + 2) * STEP_MS;

    assert.equal(verifyTotpCode(secret, code, { window: 1, nowMs: nowTwoStepsLater }), false);
  });
});
