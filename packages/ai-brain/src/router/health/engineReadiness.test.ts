import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createConnectorService,
  createPrismaClient,
  type PrismaClient,
} from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";

import { checkEngineReadiness } from "./engineReadiness";

async function seedOnlineLlmConnector(db: PrismaClient, name: string) {
  const service = createConnectorService(db);
  const { connector } = await service.createConnector(name);
  await service.heartbeat(connector.id, {
    capabilities: ["llm_local"],
    models: [{ id: "m1", provider: "ollama", name: "llama3.2", modelType: "chat" }],
  });
  return connector;
}

describe("checkEngineReadiness", () => {
  it("reports connector readiness when direct inference is offline", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());
    await seedOnlineLlmConnector(isolated, "Unified Ready");

    const status = await checkEngineReadiness({
      prisma: isolated,
      env: {
        ...process.env,
        AI_USE_MOCK: "false",
        AI_INFERENCE_BASE_URL: "http://127.0.0.1:59999",
        AI_INFERENCE_DISABLED: "false",
        AI_BRAIN_ENABLED: "true",
      },
    });

    assert.equal(status.ready, true);
    assert.equal(status.source, "connector");
    assert.equal(status.connectorReady, true);
    assert.match(status.message, /Maschinenraum bereit/);
  });

  it("returns direct inference status when no prisma client is provided", async () => {
    const status = await checkEngineReadiness({
      useMock: true,
    });

    assert.equal(status.ready, true);
    assert.notEqual(status.source, "connector");
  });

  it("stays offline when neither connector nor direct inference is available", async () => {
    const isolated = createPrismaClient(createTestDatabaseUrl());

    const status = await checkEngineReadiness({
      prisma: isolated,
      env: {
        ...process.env,
        AI_USE_MOCK: "false",
        AI_INFERENCE_BASE_URL: "http://127.0.0.1:59999",
        AI_INFERENCE_DISABLED: "false",
        AI_BRAIN_ENABLED: "true",
      },
    });

    assert.equal(status.ready, false);
    assert.equal(status.connectorReady, false);
  });
});
