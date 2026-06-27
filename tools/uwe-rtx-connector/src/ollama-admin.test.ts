import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OllamaAdmin, type OllamaPullProgress } from "./ollama-admin";

function streamResponse(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const line of lines) {
        controller.enqueue(encoder.encode(line));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe("OllamaAdmin.listModels", () => {
  it("maps /api/tags entries and returns [] when unreachable", async () => {
    const fetchOk = (async () =>
      new Response(
        JSON.stringify({ models: [{ name: "llama3.2:latest", size: 123, details: { family: "llama" } }] }),
        { status: 200 },
      )) as unknown as typeof fetch;
    const admin = new OllamaAdmin("http://127.0.0.1:11434", fetchOk);
    const models = await admin.listModels();
    assert.equal(models.length, 1);
    assert.equal(models[0].name, "llama3.2:latest");
    assert.equal(models[0].sizeBytes, 123);
    assert.equal(models[0].family, "llama");

    const fetchFail = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const offline = new OllamaAdmin("http://127.0.0.1:11434", fetchFail);
    assert.deepEqual(await offline.listModels(), []);
  });
});

describe("OllamaAdmin.pullModel", () => {
  it("streams NDJSON progress with computed fractions", async () => {
    const fetchImpl = (async () =>
      streamResponse([
        '{"status":"pulling manifest"}\n',
        '{"status":"downloading","total":100,"completed":50}\n',
        '{"status":"success"}\n',
      ])) as unknown as typeof fetch;
    const admin = new OllamaAdmin("http://127.0.0.1:11434", fetchImpl);

    const events: OllamaPullProgress[] = [];
    await admin.pullModel("llama3.2", (p) => events.push(p));

    assert.equal(events.length, 3);
    assert.equal(events[0].status, "pulling manifest");
    assert.equal(events[1].fraction, 0.5);
    assert.equal(events[2].status, "success");
  });

  it("rejects when the stream reports an error", async () => {
    const fetchImpl = (async () =>
      streamResponse(['{"error":"model not found"}\n'])) as unknown as typeof fetch;
    const admin = new OllamaAdmin("http://127.0.0.1:11434", fetchImpl);

    await assert.rejects(() => admin.pullModel("nope"), /model not found/);
  });

  it("rejects when the model name is blank", async () => {
    const admin = new OllamaAdmin("http://127.0.0.1:11434");
    await assert.rejects(() => admin.pullModel("   "), /Modellname fehlt/);
  });
});
