import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The Brain assistant must never reach a cloud provider. That guarantee comes
 * from two pinned request fields, so guard them at the source: a future edit
 * that loosens `providerMode` or introduces a cloud context mode fails here
 * instead of silently shipping personal data to an API.
 */
const runnerSource = readFileSync(path.join(import.meta.dirname, "chat-runner.ts"), "utf8");

describe("chat-runner privacy invariants", () => {
  it("pins providerMode to local_rtx", () => {
    assert.match(runnerSource, /providerMode:\s*"local_rtx"/);
    assert.doesNotMatch(runnerSource, /providerMode:\s*"(cloud|auto)"/);
  });

  it("only ever uses local-only or general chat context modes", () => {
    // contextModeFor maps the two Brain modes; nothing else may appear.
    assert.match(runnerSource, /return mode === "life_brain" \? "personal_brain" : "general_chat"/);
  });

  it("never names a cloud provider id", () => {
    assert.doesNotMatch(runnerSource, /cloudProviderId/);
    assert.doesNotMatch(runnerSource, /\b(openai|anthropic|gemini|openrouter)\b/i);
  });

  it("persists the question before generating, so a failure cannot lose it", () => {
    const questionAt = runnerSource.indexOf('role: "user"');
    const generateAt = runnerSource.indexOf("executeAiGatewayRequest(");
    assert.ok(questionAt > 0 && questionAt < generateAt);
  });

  it("turns a generation failure into a stored error message, not a thrown request", () => {
    assert.match(runnerSource, /errorMessage,\s*\}\);/);
    assert.match(runnerSource, /return \{ kind: "completed", message \};/);
  });
});
