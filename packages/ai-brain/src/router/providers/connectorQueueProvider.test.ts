import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createConnectorService,
  createConnectorWorkflowService,
  createPrismaClient,
  type PrismaClient,
} from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";

import { getDirectConnectorRegistry } from "@uwe/connector/direct";

import {
  isConnectorEmbeddingAvailable,
  isConnectorImageAvailable,
  isConnectorLlmAvailable,
  resolveConnectorWorkflowModel,
  runConnectorEmbeddingGenerate,
  runConnectorImageGenerate,
  runConnectorLlmGenerate,
  runConnectorVisionExtract,
  tryConnectorLlmGenerate,
  workflowSlotForTask,
} from "./connectorQueueProvider";

async function onlineLlmConnector(
  db: PrismaClient,
  name: string,
  models: Array<{ id: string; provider: string; name: string }> = [],
  capabilities: Array<
    "llm_local" | "embedding_local" | "image_generation" | "vision_local"
  > = [
    "llm_local",
    "embedding_local",
  ],
) {
  const service = createConnectorService(db);
  const { connector } = await service.createConnector(name);
  await service.heartbeat(connector.id, {
    capabilities,
    models,
  });
  return connector;
}

/**
 * Simulate an online connector claiming and completing the next pending job of
 * a given type, mirroring the real connector runner without a live worker.
 */
async function simulateConnectorCompletion(
  db: PrismaClient,
  connectorId: string,
  type: string,
  result: Record<string, unknown>,
): Promise<void> {
  const service = createConnectorService(db);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const pending = await db.connectorJob.findFirst({
      where: { type, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    if (pending) {
      await service.claimJob({ connectorId, availableLanes: ["gpu"] });
      await service.completeJob(pending.id, connectorId, result);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`No pending ${type} job appeared to simulate.`);
}

async function simulateDirectCompletion(
  stream: ReadableStream<Uint8Array>,
  connectorId: string,
  result: Record<string, unknown>,
): Promise<string> {
  const registry = getDirectConnectorRegistry();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("Direct stream closed before a request arrived.");
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const frame = JSON.parse(line) as Record<string, unknown>;
        if (frame.kind !== "request" || typeof frame.requestId !== "string") continue;
        assert.equal(
          registry.handleEvent(connectorId, {
            version: 1,
            kind: "accepted",
            requestId: frame.requestId,
          }).ok,
          true,
        );
        assert.equal(
          registry.handleEvent(connectorId, {
            version: 1,
            kind: "result",
            requestId: frame.requestId,
            result,
          }).ok,
          true,
        );
        return frame.requestId;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

describe("connectorQueueProvider", () => {
  it("reports llm/embedding/image availability only when a connector advertises it", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    assert.equal(await isConnectorLlmAvailable(isolated), false);
    assert.equal(await isConnectorEmbeddingAvailable(isolated), false);
    assert.equal(await isConnectorImageAvailable(isolated), false);

    await onlineLlmConnector(isolated, "Avail Test");
    assert.equal(await isConnectorLlmAvailable(isolated), true);
    assert.equal(await isConnectorEmbeddingAvailable(isolated), true);
    assert.equal(await isConnectorImageAvailable(isolated), false);

    await onlineLlmConnector(isolated, "Image Test", [], ["image_generation"]);
    assert.equal(await isConnectorImageAvailable(isolated), true);
  });

  it("dispatches LLM inference directly without creating a ConnectorJob", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    const registry = getDirectConnectorRegistry();
    const connectorId = "direct-ai-test";
    const session = registry.openSession({ connectorId, capabilities: ["llm_local"] });
    const completion = simulateDirectCompletion(session.stream, connectorId, {
      text: "Direct result",
      model: "llama3.2",
      provider: "ollama",
    });

    try {
      const result = await runConnectorLlmGenerate(isolated, {
        prompt: "Answer directly",
        model: "llama3.2",
      });
      const requestId = await completion;

      assert.equal(result.text, "Direct result");
      assert.equal(result.model, "llama3.2");
      assert.equal(result.jobId, requestId);
      assert.equal(result.delivery, "direct");
      assert.equal(await isolated.connectorJob.count(), 0);
    } finally {
      session.close();
      await completion.catch(() => undefined);
    }
  });

  it("enqueues a vision_extract job and returns OCR text", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    const connector = await onlineLlmConnector(isolated, "Vision Run", [], ["vision_local"]);

    const [result] = await Promise.all([
      runConnectorVisionExtract(isolated, {
        prompt: "Transkribiere",
        images: ["abc123"],
        mimeType: "image/jpeg",
      }),
      simulateConnectorCompletion(isolated, connector.id, "vision_extract", {
        text: "Rechnung Nr. 42",
        model: "llava",
        provider: "ollama",
      }),
    ]);

    assert.equal(result.text, "Rechnung Nr. 42");
    assert.equal(result.model, "llava");
    assert.ok(result.jobId);
  });

  it("falls back to the queue when no Direct Connector session is available", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    const connector = await onlineLlmConnector(isolated, "LLM Run");

    const [result] = await Promise.all([
      runConnectorLlmGenerate(isolated, { prompt: "Erzähl mir was", model: "llama3.2" }),
      simulateConnectorCompletion(isolated, connector.id, "llm_generate", {
        text: "Es war einmal …",
        model: "llama3.2",
        provider: "ollama",
      }),
    ]);

    assert.equal(result.text, "Es war einmal …");
    assert.equal(result.model, "llama3.2");
    assert.equal(result.delivery, "queue");
    assert.ok(result.jobId);

    const job = await isolated.connectorJob.findUnique({ where: { id: result.jobId } });
    assert.equal(job?.type, "llm_generate");
    assert.deepEqual(job?.payload, { prompt: "Erzähl mir was", model: "llama3.2" });
  });

  it("enqueues an embedding_generate job and returns the vector", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    const connector = await onlineLlmConnector(isolated, "Embed Run");

    const [result] = await Promise.all([
      runConnectorEmbeddingGenerate(isolated, { input: "vektorisiere mich" }),
      simulateConnectorCompletion(isolated, connector.id, "embedding_generate", {
        embedding: [0.1, 0.2, 0.3],
        model: "nomic-embed-text",
      }),
    ]);

    assert.deepEqual(result.embedding, [0.1, 0.2, 0.3]);
    assert.equal(result.model, "nomic-embed-text");
  });

  it("enqueues an image_generate job and returns base64 image data", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    const connector = await onlineLlmConnector(isolated, "Image Run", [], ["image_generation"]);

    const [result] = await Promise.all([
      runConnectorImageGenerate(isolated, { task: "generate", prompt: "a red dragon" }),
      simulateConnectorCompletion(isolated, connector.id, "image_generate", {
        image: "aGVsbG8=",
        mime_type: "image/png",
      }),
    ]);

    assert.equal(result.success, true);
    assert.equal(result.providerUsed, "local_rtx");
    assert.equal(result.imageBase64, "aGVsbG8=");
    assert.equal(result.mimeType, "image/png");
  });

  it("maps task types to workflow slots and resolves stored default models", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    const connector = await onlineLlmConnector(isolated, "Workflow Default", [
      { id: "m-dnd", provider: "ollama", name: "llama3.1:70b" },
    ]);

    assert.equal(workflowSlotForTask("create_npc"), "dnd");
    assert.equal(workflowSlotForTask("create_knowledge_text"), "dnd");
    assert.equal(workflowSlotForTask("summarize_page"), "analysis");
    assert.equal(workflowSlotForTask("prepare_mail_draft"), "chat");
    assert.equal(workflowSlotForTask("terra_name_regions"), "dnd");
    assert.equal(workflowSlotForTask("terra_describe_region"), "dnd");
    assert.equal(workflowSlotForTask("terra_world_draft"), "dnd");

    assert.equal(await resolveConnectorWorkflowModel(isolated, "create_npc"), null);

    await createConnectorWorkflowService(isolated).setDefault("dnd", connector.id, "m-dnd");
    assert.equal(await resolveConnectorWorkflowModel(isolated, "create_npc"), "llama3.1:70b");
  });

  it("tryConnectorLlmGenerate returns null when no connector is available", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    const outcome = await tryConnectorLlmGenerate(isolated, {
      taskType: "summarize_page",
      resolvedModel: "llama3.2",
      systemPrompt: "system",
      userPrompt: "frage",
      providerId: "ollama",
    });
    assert.equal(outcome, null);
  });

  it("tryConnectorLlmGenerate prefers the workflow default model when none is explicit", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    const connector = await onlineLlmConnector(isolated, "Try Default", [
      { id: "m-dnd", provider: "ollama", name: "qwen2.5:32b" },
    ]);
    await createConnectorWorkflowService(isolated).setDefault("dnd", connector.id, "m-dnd");

    const [outcome] = await Promise.all([
      tryConnectorLlmGenerate(isolated, {
        taskType: "create_npc",
        resolvedModel: "llama3.2",
        systemPrompt: "system",
        userPrompt: "Erstelle einen NPC",
        providerId: "ollama",
      }),
      simulateConnectorCompletion(isolated, connector.id, "llm_generate", {
        text: "NPC: Borin",
        model: "qwen2.5:32b",
      }),
    ]);

    assert.ok(outcome);
    assert.equal(outcome.result.text, "NPC: Borin");
    assert.equal(outcome.model, "qwen2.5:32b");
    assert.equal(outcome.result.provider, "ollama");

    const job = await isolated.connectorJob.findFirst({ where: { type: "llm_generate" } });
    assert.deepEqual(job?.payload, {
      prompt: "Erstelle einen NPC",
      system: "system",
      model: "qwen2.5:32b",
    });
  });
});
