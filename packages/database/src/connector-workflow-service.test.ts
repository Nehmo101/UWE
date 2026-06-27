import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createPrismaClient, type PrismaClient } from "./client";
import { createConnectorService } from "./connector-service";
import {
  ConnectorWorkflowValidationError,
  createConnectorWorkflowService,
  pickerModelId,
} from "./connector-workflow-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("ConnectorWorkflowService", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  async function onlineConnectorWithModels(name: string) {
    const connectors = createConnectorService(db);
    const { connector } = await connectors.createConnector(name);
    await connectors.heartbeat(connector.id, {
      capabilities: ["llm_local", "embedding_local"],
      models: [
        {
          id: "ollama:llama3.1:8b",
          provider: "ollama",
          name: "llama3.1:8b",
          modelType: "chat",
          displayName: "Llama 3.1 8B",
          description: "Allrounder",
          bestFor: ["Chat", "DnD-Generator"],
          enabledForUwe: true,
        },
        {
          id: "ollama:nomic-embed-text",
          provider: "ollama",
          name: "nomic-embed-text",
          modelType: "embedding",
          displayName: "Nomic Embed",
          enabledForUwe: true,
        },
      ],
    });
    return connector;
  }

  it("derives a stable model id, preferring the reported id", () => {
    assert.equal(pickerModelId({ id: "ollama:foo", provider: "ollama", name: "foo" }), "ollama:foo");
    assert.equal(pickerModelId({ provider: "ollama", name: "foo" }), "ollama:foo");
  });

  it("lists picker models only from online connectors with metadata", async () => {
    const isolatedDb = createPrismaClient(createTestDatabaseUrl());
    const connectors = createConnectorService(isolatedDb);
    const workflow = createConnectorWorkflowService(isolatedDb);

    // Offline connector (never sends heartbeat) — must be excluded.
    await connectors.createConnector("Offline RTX");

    const online = await connectors.createConnector("Online RTX");
    await connectors.heartbeat(online.connector.id, {
      capabilities: ["llm_local"],
      models: [
        {
          id: "ollama:llama3.1:8b",
          provider: "ollama",
          name: "llama3.1:8b",
          modelType: "chat",
          displayName: "Llama 3.1 8B",
          bestFor: ["Chat"],
          enabledForUwe: true,
        },
      ],
    });

    const models = await workflow.listPickerModels();
    assert.equal(models.length, 1);
    assert.equal(models[0].modelId, "ollama:llama3.1:8b");
    assert.equal(models[0].connectorId, online.connector.id);
    assert.equal(models[0].displayName, "Llama 3.1 8B");
    assert.deepEqual(models[0].bestFor, ["Chat"]);
  });

  it("sets and reads a workflow default for a slot", async () => {
    const connector = await onlineConnectorWithModels("Default RTX");
    const workflow = createConnectorWorkflowService(db);

    const saved = await workflow.setDefault("chat", connector.id, "ollama:llama3.1:8b");
    assert.equal(saved.slot, "chat");
    assert.equal(saved.connectorId, connector.id);
    assert.equal(saved.modelId, "ollama:llama3.1:8b");
    assert.equal(saved.model?.displayName, "Llama 3.1 8B");

    const fetched = await workflow.getDefault("chat");
    assert.equal(fetched?.modelId, "ollama:llama3.1:8b");

    const defaults = await workflow.listDefaults();
    assert.equal(defaults.length, 1);
    assert.equal(defaults[0].slot, "chat");
  });

  it("replaces an existing default for the same slot (upsert)", async () => {
    const isolatedDb = createPrismaClient(createTestDatabaseUrl());
    const connectors = createConnectorService(isolatedDb);
    const workflow = createConnectorWorkflowService(isolatedDb);
    const { connector } = await connectors.createConnector("Upsert RTX");
    await connectors.heartbeat(connector.id, {
      capabilities: ["llm_local"],
      models: [
        { id: "ollama:a", provider: "ollama", name: "a", modelType: "chat", enabledForUwe: true },
        { id: "ollama:b", provider: "ollama", name: "b", modelType: "chat", enabledForUwe: true },
      ],
    });

    await workflow.setDefault("dnd", connector.id, "ollama:a");
    await workflow.setDefault("dnd", connector.id, "ollama:b");

    const fetched = await workflow.getDefault("dnd");
    assert.equal(fetched?.modelId, "ollama:b");
    const rows = await isolatedDb.connectorWorkflowDefault.findMany({ where: { slot: "dnd" } });
    assert.equal(rows.length, 1);
  });

  it("rejects a default for a model the connector does not report", async () => {
    const connector = await onlineConnectorWithModels("Validate RTX");
    const workflow = createConnectorWorkflowService(db);

    await assert.rejects(
      () => workflow.setDefault("vision", connector.id, "ollama:does-not-exist"),
      ConnectorWorkflowValidationError,
    );
  });

  it("clears a default", async () => {
    const connector = await onlineConnectorWithModels("Clear RTX");
    const workflow = createConnectorWorkflowService(db);

    await workflow.setDefault("embedding", connector.id, "ollama:nomic-embed-text");
    assert.ok(await workflow.getDefault("embedding"));

    await workflow.clearDefault("embedding");
    assert.equal(await workflow.getDefault("embedding"), null);
  });

  it("returns a default with a null model when the connector stops reporting it", async () => {
    const isolatedDb = createPrismaClient(createTestDatabaseUrl());
    const connectors = createConnectorService(isolatedDb);
    const workflow = createConnectorWorkflowService(isolatedDb);
    const { connector } = await connectors.createConnector("Stale RTX");
    await connectors.heartbeat(connector.id, {
      capabilities: ["llm_local"],
      models: [
        { id: "ollama:gone", provider: "ollama", name: "gone", modelType: "chat", enabledForUwe: true },
      ],
    });

    await workflow.setDefault("analysis", connector.id, "ollama:gone");
    // Connector re-reports without that model.
    await connectors.heartbeat(connector.id, { capabilities: ["llm_local"], models: [] });

    const fetched = await workflow.getDefault("analysis");
    assert.equal(fetched?.modelId, "ollama:gone");
    assert.equal(fetched?.model, null);
  });
});
