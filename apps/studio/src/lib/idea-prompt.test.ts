import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeIdeaChatPrompt,
  composeIdeaPromptGeneration,
  renderAttachmentsBlock,
  resolveAttachmentUrl,
} from "./idea-prompt";

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

describe("renderAttachmentsBlock", () => {
  it("returns an empty string when there are no attachments", () => {
    assert.equal(renderAttachmentsBlock([]), "");
    assert.equal(renderAttachmentsBlock(), "");
  });

  it("lists each attachment with its title and served URL", () => {
    const block = renderAttachmentsBlock(
      [
        { assetId: "asset-1", title: "Mockup" },
        { assetId: "asset-2" },
      ],
      "https://studio.example",
    );
    assert.match(block, /# Angehängte Bilder/);
    assert.match(block, /- Mockup: https:\/\/studio\.example\/api\/assets\/asset-1\/file/);
    assert.match(block, /- Bild 2: https:\/\/studio\.example\/api\/assets\/asset-2\/file/);
  });

  it("builds relative URLs when no base URL is given", () => {
    assert.equal(resolveAttachmentUrl("abc"), "/api/assets/abc/file");
  });
});

describe("composeIdeaChatPrompt with attachments", () => {
  it("injects the attachments block before the new message and keeps Assistent: last", () => {
    const prompt = composeIdeaChatPrompt("X", "", [], "Hallo", {
      attachments: [{ assetId: "asset-1", title: "Screenshot" }],
      baseUrl: "https://studio.example",
    });
    assert.match(prompt, /# Angehängte Bilder/);
    assert.match(prompt, /Screenshot: https:\/\/studio\.example\/api\/assets\/asset-1\/file/);
    assert.match(prompt, /# Neue Nachricht\nNutzer: Hallo\nAssistent:$/);
  });
});
