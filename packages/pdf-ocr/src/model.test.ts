import assert from "node:assert/strict";
import test from "node:test";
import {
  DOCUMENT_PARSING_PROMPT,
  MULTI_PAGE_PARSING_PROMPT,
  UNLIMITED_OCR_MODEL,
  buildOcrPrompt,
  isUnlimitedOcrModel,
} from "./model";

test("erkennt Unlimited-OCR über Tags und Forks hinweg", () => {
  for (const model of [
    UNLIMITED_OCR_MODEL,
    "baidu/Unlimited-OCR",
    "unlimited_ocr:f16",
    "vimalnakrani/unlimited-ocr-gguf",
  ]) {
    assert.equal(isUnlimitedOcrModel(model), true, model);
  }
});

test("generische Vision-Modelle gelten nicht als Unlimited-OCR", () => {
  for (const model of ["llava", "qwen2.5-vl:7b", "minicpm-v", null, undefined]) {
    assert.equal(isUnlimitedOcrModel(model), false, String(model));
  }
});

test("nutzt den trainierten Prompt je nach Seitenzahl", () => {
  assert.equal(buildOcrPrompt({ pageCount: 1, model: UNLIMITED_OCR_MODEL }), DOCUMENT_PARSING_PROMPT);
  assert.equal(buildOcrPrompt({ pageCount: 4, model: UNLIMITED_OCR_MODEL }), MULTI_PAGE_PARSING_PROMPT);
});

test("generische Modelle bekommen einen erklärenden Prompt statt des image-Tokens", () => {
  const prompt = buildOcrPrompt({ pageCount: 1, model: "llava" });

  assert.ok(!prompt.includes("<image>"));
  assert.ok(prompt.includes("Markdown"));
});
