import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createConnectorService,
  createConnectorWorkflowService,
  createPrismaClient,
  type PrismaClient,
} from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";

import {
  isConnectorEmbeddingAvailable,
  isConnectorLlmAvailable,
  resolveConnectorWorkflowModel,
  runConnectorEmbeddingGenerate,
  runConnectorLlmGenerate,
  tryConnectorLlmGenerate,
  workflowSlotForTask,
} from "./connectorQueueProvider";

async function onlineLlmConnector(
  db: PrismaClient,
  name: string,
  models: Array<{ id: string; provider: string; name: string }> = [],
) {
  const service = createConnectorService(db);
  const { connector } = await service.createConnector(name);
  await service.heartbeat(connector.id, {
    capabilities: ["llm_local", "embedding_local"],
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

describe("connectorQueueProvider", () => {
  it("reports llm/embedding availability only when a connector advertises it", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    assert.equal(await isConnectorLlmAvailable(isolated), false);
    assert.equal(await isConnectorEmbeddingAvailable(isolated), false);

    await onlineLlmConnector(isolated, "Avail Test");
    assert.equal(await isConnectorLlmAvailable(isolated), true);
    assert.equal(await isConnectorEmbeddingAvailable(isolated), true);
  });

  it("enqueues an llm_generate job and returns the connector result", async () => {
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

  it("maps task types to workflow slots and resolves stored default models", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    const connector = await onlineLlmConnector(isolated, "Workflow Default", [
      { id: "m-dnd", provider: "ollama", name: "llama3.1:70b" },
    ]);

    assert.equal(workflowSlotForTask("create_npc"), "dnd");
    assert.equal(workflowSlotForTask("create_knowledge_text"), "dnd");
    assert.equal(workflowSlotForTask("summarize_page"), "analysis");
    assert.equal(workflowSlotForTask("prepare_mail_draft"), "chat");

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
