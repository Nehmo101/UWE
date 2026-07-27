import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { buildChatCompletionBody } from "./base";
import { OllamaProvider } from "./openai-family";

/**
 * The protocol half of the JSON story: does the flag actually reach the wire?
 *
 * Asking for JSON in the prompt is a request; `response_format` / `format` is
 * an instruction the runtime enforces. These tests exist because the difference
 * is invisible from the outside — a body that quietly dropped the field would
 * still work most of the time, and fail exactly on the small local models the
 * feature was built for.
 */
describe("OpenAI-shaped body carries response_format only when JSON was asked for", () => {
  it("adds response_format for json", () => {
    const body = buildChatCompletionBody({
      model: "gpt-4o-mini",
      prompt: "p",
      responseFormat: "json",
    }) as Record<string, unknown>;

    assert.deepEqual(body.response_format, { type: "json_object" });
  });

  it("omits response_format for prose — a recap must not come back quoted", () => {
    for (const format of [undefined, "text" as const]) {
      const body = buildChatCompletionBody({
        model: "gpt-4o-mini",
        prompt: "p",
        ...(format ? { responseFormat: format } : {}),
      }) as Record<string, unknown>;

      assert.equal("response_format" in body, false, String(format));
    }
  });

  it("leaves the rest of the body untouched", () => {
    const body = buildChatCompletionBody({
      model: "m",
      prompt: "p",
      systemPrompt: "s",
      maxTokens: 100,
      responseFormat: "json",
    }) as Record<string, unknown>;

    assert.equal(body.model, "m");
    assert.equal(body.max_tokens, 100);
    assert.equal(body.stream, false);
    assert.deepEqual(body.messages, [
      { role: "system", content: "s" },
      { role: "user", content: "p" },
    ]);
  });
});

describe("Ollama sends format:json — the one backend that truly enforces it", () => {
  let originalFetch: typeof globalThis.fetch;
  let lastBody: Record<string, unknown> | null = null;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    lastBody = null;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      lastBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(JSON.stringify({ message: { content: '{"a":1}' }, model: "llama3.2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sets format json when requested", async () => {
    const provider = new OllamaProvider("http://127.0.0.1:11434");
    await provider.generateText({ model: "llama3.2", prompt: "p", responseFormat: "json" });

    assert.equal(lastBody?.format, "json");
  });

  it("leaves format unset for prose tasks", async () => {
    const provider = new OllamaProvider("http://127.0.0.1:11434");
    await provider.generateText({ model: "llama3.2", prompt: "p" });

    assert.equal(lastBody !== null && "format" in lastBody, false);
  });
});
