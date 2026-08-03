import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runOpenAiCompatibleChat, runOpenAiCompatibleEmbedding, runOpenAiCompatibleVision } from "./openai-compatible-llm";

describe("openai-compatible-llm", () => {
  it("calls /v1/chat/completions for LM Studio", async () => {
    let seenUrl = "";
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      seenUrl = String(url);
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body)) as { model: string; messages: unknown[] };
      assert.equal(body.model, "local-model");
      assert.ok(Array.isArray(body.messages));
      return new Response(
        JSON.stringify({ model: "local-model", choices: [{ message: { content: "Hallo" } }] }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await runOpenAiCompatibleChat(
      "http://127.0.0.1:1234",
      "lmstudio",
      { prompt: "Hi", model: "local-model" },
      1000,
      fetchImpl,
    );
    assert.match(seenUrl, /\/v1\/chat\/completions$/);
    assert.equal(result.text, "Hallo");
    assert.equal(result.provider, "lmstudio");
  });

  it("calls /v1/embeddings for llama.cpp", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
        status: 200,
      })) as typeof fetch;

    const result = await runOpenAiCompatibleEmbedding(
      "http://127.0.0.1:8080/v1",
      "llamacpp",
      { input: "test", model: "embed-model" },
      1000,
      fetchImpl,
    );
    assert.deepEqual(result.embedding, [0.1, 0.2]);
    assert.equal(result.provider, "llamacpp");
  });

  it("calls /v1/chat/completions with multimodal content for vision", async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({ model: "vision-model", choices: [{ message: { content: "Text" } }] }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await runOpenAiCompatibleVision(
      "http://127.0.0.1:1234",
      "lmstudio",
      { prompt: "OCR", images: ["abc123"], model: "vision-model" },
      1000,
      fetchImpl,
    );
    const messages = body.messages as Array<{ content: Array<{ type: string }> }>;
    assert.equal(messages[0]?.content.length, 2);
    assert.equal(result.text, "Text");
    assert.equal(result.provider, "lmstudio");
  });
});
