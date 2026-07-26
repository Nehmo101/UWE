import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASSISTANT_ATTACHMENT_TEXT_LIMIT,
  ASSISTANT_MAX_HISTORY,
} from "./assistant-types";
import { buildAssistantPrompt, truncateForPrompt } from "./chat-prompt";

describe("buildAssistantPrompt", () => {
  it("returns the bare question for a first turn without extras", () => {
    const prompt = buildAssistantPrompt({
      messages: [{ role: "user", content: "  Was steht heute an?  " }],
    });
    assert.equal(prompt, "Was steht heute an?");
  });

  it("flattens the history ahead of the current question", () => {
    const prompt = buildAssistantPrompt({
      messages: [
        { role: "user", content: "Hallo" },
        { role: "assistant", content: "Hallo!" },
        { role: "user", content: "Wie viele Filamente habe ich?" },
      ],
    });

    assert.match(prompt, /Gesprächsverlauf:\nNutzer: Hallo\nAssistent: Hallo!/);
    assert.match(prompt, /Aktuelle Frage: Wie viele Filamente habe ich\?$/);
  });

  it("keeps only the most recent history window", () => {
    const messages = Array.from({ length: ASSISTANT_MAX_HISTORY + 10 }, (_, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Nachricht ${index}`,
    }));
    messages.push({ role: "user", content: "Letzte Frage" });

    const prompt = buildAssistantPrompt({ messages });

    assert.doesNotMatch(prompt, /Nachricht 0\b/);
    assert.match(prompt, /Aktuelle Frage: Letzte Frage$/);
  });

  it("orders attachments and personal context before the transcript", () => {
    const prompt = buildAssistantPrompt({
      messages: [
        { role: "user", content: "Erste" },
        { role: "assistant", content: "Antwort" },
        { role: "user", content: "Was ist auf dem Bild?" },
      ],
      attachments: [{ kind: "image", filename: "regal.jpg", text: "Ein Regal mit Spulen." }],
      ragContext: "Filament-Notiz: 4 Spulen PLA.",
    });

    const attachmentAt = prompt.indexOf("Angehängte Inhalte:");
    const contextAt = prompt.indexOf("Persönlicher Kontext");
    const transcriptAt = prompt.indexOf("Gesprächsverlauf:");
    const questionAt = prompt.indexOf("Aktuelle Frage:");

    assert.ok(attachmentAt >= 0 && attachmentAt < contextAt);
    assert.ok(contextAt < transcriptAt);
    assert.ok(transcriptAt < questionAt);
    assert.match(prompt, /\[Bild: regal\.jpg\]/);
  });

  it("skips attachments that produced no text", () => {
    const prompt = buildAssistantPrompt({
      messages: [{ role: "user", content: "Frage" }],
      attachments: [{ kind: "document", filename: "leer.pdf", text: "   " }],
    });
    assert.equal(prompt, "Frage");
  });

  it("truncates an oversized attachment instead of failing", () => {
    const prompt = buildAssistantPrompt({
      messages: [{ role: "user", content: "Fasse zusammen" }],
      attachments: [{ kind: "document", filename: "gross.pdf", text: "a".repeat(50_000) }],
    });

    assert.match(prompt, /\[gekürzt\]/);
    assert.ok(prompt.length < ASSISTANT_ATTACHMENT_TEXT_LIMIT + 2_000);
  });

  it("caps the combined attachment budget across many files", () => {
    const attachments = Array.from({ length: 8 }, (_, index) => ({
      kind: "document" as const,
      filename: `datei-${index}.txt`,
      text: "b".repeat(5_000),
    }));

    const prompt = buildAssistantPrompt({
      messages: [{ role: "user", content: "Frage" }],
      attachments,
    });

    // Total attachment budget is 16k — far below 8 × 5k.
    assert.ok(prompt.length < 20_000, `prompt was ${prompt.length} chars`);
  });

  it("puts the owner's instruction first, since the router has no system-prompt slot", () => {
    const prompt = buildAssistantPrompt({
      messages: [{ role: "user", content: "Frage" }],
      systemPrompt: "Antworte immer in Stichpunkten.",
    });

    assert.ok(prompt.startsWith("Anweisung: Antworte immer in Stichpunkten."));
    assert.match(prompt, /Aktuelle Frage: Frage$/);
  });

  it("ignores a blank instruction", () => {
    const prompt = buildAssistantPrompt({
      messages: [{ role: "user", content: "Frage" }],
      systemPrompt: "   ",
    });
    assert.equal(prompt, "Frage");
  });

  it("requires at least one user message", () => {
    assert.throws(
      () => buildAssistantPrompt({ messages: [{ role: "assistant", content: "Hallo" }] }),
      /Mindestens eine Nutzer-Nachricht/,
    );
  });
});

describe("truncateForPrompt", () => {
  it("leaves short text untouched", () => {
    assert.equal(truncateForPrompt("  kurz  ", 100), "kurz");
  });

  it("marks the cut", () => {
    const result = truncateForPrompt("x".repeat(500), 100);
    assert.match(result, /\[gekürzt\]$/);
  });

  it("prefers a line break near the limit", () => {
    const text = `${"a".repeat(80)}\n${"b".repeat(80)}`;
    const result = truncateForPrompt(text, 100);
    assert.equal(result, `${"a".repeat(80)}\n… [gekürzt]`);
  });
});
