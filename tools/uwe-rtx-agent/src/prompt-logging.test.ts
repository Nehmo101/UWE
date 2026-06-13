import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarizeMessages } from "./ollama.js";
import { createTestConfig } from "./test-helpers.js";

describe("prompt logging", () => {
  it("defaults LOG_PROMPTS to false in test config", () => {
    assert.equal(createTestConfig().logPrompts, false);
  });

  it("summarizeMessages records lengths only, not prompt text", () => {
    const summary = summarizeMessages([
      { role: "system", content: "Geheimes Brain-Wissen über Validori" },
      { role: "user", content: "Was weiß die Kampagne?" },
    ]);

    assert.match(summary, /system:\d+, user:\d+/);
    assert.doesNotMatch(summary, /Validori|Kampagne|Geheimes/i);
  });
});
