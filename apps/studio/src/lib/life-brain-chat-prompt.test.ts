import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLifeBrainChatPrompt } from "./life-brain-chat-prompt";

describe("buildLifeBrainChatPrompt", () => {
  it("returns the question directly for a single message", () => {
    const prompt = buildLifeBrainChatPrompt([{ role: "user", content: "Was ist X?" }]);
    assert.equal(prompt, "Was ist X?");
  });

  it("includes history before the current question", () => {
    const prompt = buildLifeBrainChatPrompt([
      { role: "user", content: "Was ist X?" },
      { role: "assistant", content: "X ist Y." },
      { role: "user", content: "Und warum?" },
    ]);

    assert.ok(prompt.startsWith("Gesprächsverlauf:"));
    assert.ok(prompt.includes("Nutzer: Was ist X?"));
    assert.ok(prompt.includes("Assistent: X ist Y."));
    assert.ok(prompt.endsWith("Aktuelle Frage: Und warum?"));
  });

  it("throws without a user message", () => {
    assert.throws(() =>
      buildLifeBrainChatPrompt([{ role: "assistant", content: "Hallo" }]),
    );
  });
});
