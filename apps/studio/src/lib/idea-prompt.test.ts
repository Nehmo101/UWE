import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeIdeaChatPrompt, composeIdeaPromptGeneration } from "./idea-prompt";

const transcript = [
  { role: "user" as const, content: "Idee: Tagging", createdAt: "2026-01-01T00:00:00.000Z" },
  { role: "assistant" as const, content: "Welche Felder?", createdAt: "2026-01-01T00:01:00.000Z" },
];

describe("composeIdeaChatPrompt", () => {
  it("includes idea, history and the new user message", () => {
    const prompt = composeIdeaChatPrompt("Dark Mode", "Portal dark mode", transcript, "Nur Titel");
    assert.match(prompt, /# Idee: Dark Mode/);
    assert.match(prompt, /Portal dark mode/);
    assert.match(prompt, /# Bisheriger Verlauf/);
    assert.match(prompt, /Nutzer: Idee: Tagging/);
    assert.match(prompt, /Assistent: Welche Felder\?/);
    assert.match(prompt, /# Neue Nachricht\nNutzer: Nur Titel\nAssistent:$/);
  });

  it("omits the history section when transcript is empty", () => {
    const prompt = composeIdeaChatPrompt("X", "", [], "Hallo");
    assert.doesNotMatch(prompt, /# Bisheriger Verlauf/);
    assert.match(prompt, /# Idee: X/);
    assert.match(prompt, /Nutzer: Hallo/);
  });
});

describe("composeIdeaPromptGeneration", () => {
  it("frames a Cursor implementation prompt and includes the discussion", () => {
    const prompt = composeIdeaPromptGeneration("Dark Mode", "Portal dark mode", transcript);
    assert.match(prompt, /Implementierungs-Prompt/);
    assert.match(prompt, /# Idee: Dark Mode/);
    assert.match(prompt, /# Diskussion/);
    assert.match(prompt, /Schreibe jetzt den fertigen Implementierungs-Prompt/);
  });
});
