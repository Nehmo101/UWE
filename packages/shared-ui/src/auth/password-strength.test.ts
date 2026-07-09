import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluatePasswordStrength,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
} from "./password-strength";
import { formatForgotPasswordError } from "./forgot-password-errors";

describe("password strength", () => {
  it("marks empty passwords as empty strength", () => {
    const result = evaluatePasswordStrength("");
    assert.equal(result.level, "empty");
    assert.equal(result.score, 0);
  });

  it("requires minimum length before rating higher than fair", () => {
    const short = evaluatePasswordStrength("Ab1!");
    assert.equal(short.level, "weak");

    const longLowerOnly = evaluatePasswordStrength("a".repeat(PASSWORD_MIN_LENGTH));
    assert.equal(longLowerOnly.level, "fair");
    assert.ok(longLowerOnly.metRuleIds.includes("length"));
  });

  it("scores strong passwords with mixed character classes", () => {
    const result = evaluatePasswordStrength("Str0ng!Pass");
    assert.equal(result.level, "strong");
    assert.equal(result.score, 4);
    assert.equal(result.metRuleIds.length, PASSWORD_REQUIREMENTS.length);
  });
});

describe("formatForgotPasswordError", () => {
  it("adds retry guidance for rate-limited responses", () => {
    const message = formatForgotPasswordError(
      new Response(null, { status: 429, headers: { "Retry-After": "90" } }),
      { error: "Zu viele Anfragen. Bitte warte einen Moment." },
    );

    assert.match(message, /90 Sekunden|2 Minuten/);
    assert.match(message, /Zu viele Anfragen/);
  });

  it("falls back to generic error for other failures", () => {
    const message = formatForgotPasswordError(new Response(null, { status: 500 }), {});
    assert.equal(message, "Anfrage fehlgeschlagen. Bitte versuche es später erneut.");
  });
});
