import { createHash } from "node:crypto";

import type { GenerateTextResult } from "../types";

const MAX_CACHE_ENTRIES = 128;
const cache = new Map<string, GenerateTextResult>();

function cacheKey(input: {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  contextHash: string;
}): string {
  return createHash("sha256")
    .update(
      [input.model, input.contextHash, input.systemPrompt, input.userPrompt].join("\n---\n"),
    )
    .digest("hex");
}

export function hashContextForCache(promptContext: string): string {
  return createHash("sha256").update(promptContext).digest("hex").slice(0, 16);
}

export function getCachedPromptResponse(key: string): GenerateTextResult | undefined {
  return cache.get(key);
}

export function setCachedPromptResponse(key: string, result: GenerateTextResult): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      cache.delete(oldest);
    }
  }
  cache.set(key, result);
}

export function buildPromptCacheKey(input: {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  contextHash: string;
}): string {
  return cacheKey(input);
}

/** Test helper — clears in-process cache between tests. */
export function clearPromptCache(): void {
  cache.clear();
}
