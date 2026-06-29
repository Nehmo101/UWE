import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  buildPromptCacheKey,
  clearPromptCache,
  getCachedPromptResponse,
  setCachedPromptResponse,
} from "../cache/prompt-cache";

describe("prompt-cache", () => {
  beforeEach(() => {
    clearPromptCache();
  });

  it("stores and retrieves cached generate results", () => {
    const key = buildPromptCacheKey({
      systemPrompt: "sys",
      userPrompt: "user",
      model: "llama3.2",
      contextHash: "abc123",
    });
    assert.equal(getCachedPromptResponse(key), undefined);

    const result = { text: "cached", model: "llama3.2", provider: "local" as const };
    setCachedPromptResponse(key, result);
    assert.deepEqual(getCachedPromptResponse(key), result);
  });
});
