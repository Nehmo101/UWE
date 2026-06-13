import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redactSecrets } from "./redact";

describe("mail redact", () => {
  it("masks password-like fragments in error messages", () => {
    const redacted = redactSecrets("Auth failed: password=super-secret");
    assert.equal(redacted.includes("super-secret"), false);
    assert.match(redacted, /\[REDACTED\]/);
  });
});
