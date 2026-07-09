import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeCspLooseningRisks,
  reviewCspPolicy,
  validateCspPolicyInput,
} from "./csp-review";

describe("csp-review", () => {
  it("accepts a minimal valid policy", () => {
    const policy = "default-src 'self'; script-src 'self'";
    assert.deepEqual(validateCspPolicyInput(policy), []);
    assert.equal(reviewCspPolicy(policy).syntaxErrors.length, 0);
  });

  it("flags unsafe-eval and wildcards", () => {
    const policy = "script-src 'self' 'unsafe-eval' *; connect-src http://evil.test";
    const findings = analyzeCspLooseningRisks(policy);
    assert.ok(findings.some((finding) => finding.id === "unsafe-eval"));
    assert.ok(findings.some((finding) => finding.id === "wildcard"));
    assert.ok(findings.some((finding) => finding.id === "http-src"));
  });

  it("reports syntax errors for directives without values", () => {
    const errors = validateCspPolicyInput("default-src");
    assert.ok(errors.some((error) => error.includes("hat keine Werte")));
  });
});
