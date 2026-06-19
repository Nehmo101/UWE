import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assembleImageStudioPrompt,
  ImageStudioPrivacyError,
  scanPromptForPrivateDataLeak,
  validateImageContextForProvider,
} from "./prompt-privacy";

describe("image studio prompt privacy", () => {
  it("blocks cloud with private page context unless approved", () => {
    assert.throws(
      () => validateImageContextForProvider("cloud", "page_context"),
      ImageStudioPrivacyError,
    );
  });

  it("allows cloud with prompt_only context", () => {
    assert.doesNotThrow(() => validateImageContextForProvider("cloud", "prompt_only"));
  });

  it("strips private context for cloud provider", () => {
    const result = assembleImageStudioPrompt({
      prompt: "A forest temple",
      contextMode: "brain_context",
      contextSnippet: "Secret villain: Malachar",
      providerMode: "cloud",
      resolvedProvider: "cloud",
    });

    assert.equal(result.contextIncluded, false);
    assert.equal(result.prompt, "A forest temple");
    assert.ok(result.warnings.length > 0);
  });

  it("includes context for local RTX", () => {
    const result = assembleImageStudioPrompt({
      prompt: "A forest temple",
      contextMode: "page_context",
      contextSnippet: "Ancient elven ruins",
      providerMode: "local_rtx",
      resolvedProvider: "local_rtx",
    });

    assert.equal(result.contextIncluded, true);
    assert.match(result.prompt, /Ancient elven ruins/);
  });

  it("detects private data markers in cloud prompts", () => {
    const warnings = scanPromptForPrivateDataLeak("Generate art for dm_only NPC Malachar");
    assert.ok(warnings.length > 0);
  });
});
