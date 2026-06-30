import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ATLAS_STAMP_STYLE_PROMPT, assembleStampPrompt } from "./stamp-prompt";

describe("assembleStampPrompt", () => {
  it("prepends keyword to the style preset", () => {
    const prompt = assembleStampPrompt("Kirche");
    assert.strictEqual(prompt, `Kirche, ${ATLAS_STAMP_STYLE_PROMPT}`);
  });

  it("trims whitespace around keyword", () => {
    const prompt = assembleStampPrompt("  Hafen  ");
    assert.strictEqual(prompt, `Hafen, ${ATLAS_STAMP_STYLE_PROMPT}`);
  });

  it("returns only style preset when keyword is empty string", () => {
    const prompt = assembleStampPrompt("");
    assert.strictEqual(prompt, ATLAS_STAMP_STYLE_PROMPT);
  });

  it("returns only style preset when keyword is whitespace-only", () => {
    const prompt = assembleStampPrompt("   ");
    assert.strictEqual(prompt, ATLAS_STAMP_STYLE_PROMPT);
  });

  it("style preset contains core keywords", () => {
    assert.ok(ATLAS_STAMP_STYLE_PROMPT.includes("tolkien-style ink line art"));
    assert.ok(ATLAS_STAMP_STYLE_PROMPT.includes("transparent background"));
    assert.ok(ATLAS_STAMP_STYLE_PROMPT.includes("map stamp"));
  });

  it("works with non-ASCII DnD keywords", () => {
    const prompt = assembleStampPrompt("Höhle");
    assert.ok(prompt.startsWith("Höhle, "));
    assert.ok(prompt.includes(ATLAS_STAMP_STYLE_PROMPT));
  });
});
