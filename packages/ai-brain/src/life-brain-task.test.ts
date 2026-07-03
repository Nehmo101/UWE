import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTaskPrompt, buildTaskSystemPrompt } from "./tasks";
import type { AiContext } from "./types";

function makeContext(promptContext: string): AiContext {
  return {
    taskType: "answer_life_question",
    worldId: "",
    primaryPageId: "",
    pages: [],
    sources: [],
    promptContext,
    truncated: false,
    datenschutzMode: true,
    allowDmOnly: true,
  };
}

describe("answer_life_question task", () => {
  it("includes the user question in the prompt", () => {
    const prompt = buildTaskPrompt(
      "answer_life_question",
      makeContext("Dokument: Filamente — PLA schwarz, PETG rot."),
      "Welche Filamente habe ich?",
    );

    assert.ok(prompt.includes("Frage:"));
    assert.ok(prompt.includes("Welche Filamente habe ich?"));
    assert.ok(prompt.includes("Life-Brain-Kontext:"));
    assert.ok(prompt.includes("PLA schwarz"));
    assert.ok(!prompt.includes("Kampagnen-Kontext:"));
  });

  it("uses a life-brain system prompt without campaign framing", () => {
    const systemPrompt = buildTaskSystemPrompt("answer_life_question");
    assert.ok(systemPrompt.includes("Life-Brain"));
    assert.ok(!systemPrompt.includes("Pen-&-Paper"));
  });

  it("keeps campaign framing for DnD tasks", () => {
    const prompt = buildTaskPrompt("summarize_page", makeContext("Inhalt"), "Fasse zusammen");
    assert.ok(prompt.includes("Kampagnen-Kontext:"));
    assert.ok(prompt.includes("Zusätzliche Anweisung:"));
  });
});
