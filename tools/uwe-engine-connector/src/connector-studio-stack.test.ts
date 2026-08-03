/**
 * Studio HTTP stack smoke — real connector service + HTTP API surface + HostClient.
 * Proves the outbound worker path against the same routes Studio exposes, without
 * a full Next.js build.
 */

import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { after, before, describe, it } from "node:test";

import {
  createConnectorService,
  createPrismaClient,
  waitForConnectorJob,
  type PrismaClient,
} from "@uwe/database/server";
import type { ConnectorLane } from "@uwe/connector";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";

import { executeJob } from "./executors";
import { HostClient } from "./host-client";

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

describe("connector studio HTTP stack", () => {
  let db: PrismaClient;
  let baseUrl = "";
  let token = "";
  let server: ReturnType<typeof createServer>;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    const service = createConnectorService(db);
    const created = await service.createConnector("Studio Stack Smoke");
    token = created.token;

    server = createServer(async (req, res) => {
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${token}`) {
        sendJson(res, 401, { error: "unauthorized" });
        return;
      }

      const service = createConnectorService(db);
      const connector = await service.authenticate(token);
      if (!connector) {
        sendJson(res, 401, { error: "invalid token" });
        return;
      }

      if (req.method === "POST" && req.url === "/api/connectors/heartbeat") {
        const body = await readJson(req);
        const view = await service.heartbeat(connector.id, {
          capabilities: Array.isArray(body.capabilities)
            ? (body.capabilities as string[])
            : undefined,
          version: typeof body.version === "string" ? body.version : null,
          queueEnabled: body.queueEnabled !== false,
          currentJobs: typeof body.currentJobs === "number" ? body.currentJobs : 0,
        });
        sendJson(res, 200, {
          connector: {
            id: view.id,
            name: view.name,
            status: view.status,
            queueEnabled: true,
          },
          config: {
            pollIntervalMs: 100,
            heartbeatIntervalMs: 5000,
            queueEnabled: true,
            cloudFallbackAllowed: false,
            capabilities: view.capabilities,
            jobTypes: ["llm_generate", "connector_refresh_models"],
          },
          activeJobIds: [],
        });
        return;
      }

      if (req.method === "POST" && req.url === "/api/connectors/claim-job") {
        const body = await readJson(req);
        const lanes = Array.isArray(body.availableLanes)
          ? body.availableLanes.filter((lane): lane is ConnectorLane =>
              lane === "audio" ||
              lane === "spotify" ||
              lane === "gpu" ||
              lane === "printing" ||
              lane === "maintenance",
            )
          : [];
        const claimed = await service.claimJob({
          connectorId: connector.id,
          availableLanes: lanes,
        });
        if (!claimed) {
          sendJson(res, 200, { job: null });
          return;
        }
        sendJson(res, 200, {
          job: {
            id: claimed.id,
            type: claimed.type,
            lane: claimed.lane,
            priority: claimed.priority,
            payload: claimed.payload,
            worldId: claimed.worldId,
            expiresAt: claimed.expiresAt,
          },
        });
        return;
      }

      const completeMatch = req.url?.match(/^\/api\/connectors\/jobs\/([^/]+)\/complete$/);
      if (req.method === "POST" && completeMatch) {
        const jobId = completeMatch[1] ?? "";
        const body = await readJson(req);
        await service.completeJob(jobId, connector.id, (body.result as Record<string, unknown>) ?? {});
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: "not found" });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db.$disconnect();
  });

  it("runs enqueue → HostClient claim/execute/complete → waitForConnectorJob", async () => {
    const hostService = createConnectorService(db);
    const client = new HostClient(baseUrl, token);

    await client.heartbeat({
      capabilities: ["llm_local"],
      models: [],
      version: "stack-smoke",
      queueEnabled: true,
      currentJobs: 0,
      lastError: null,
    });

    const job = await hostService.enqueueJob({
      type: "llm_generate",
      payload: { prompt: "Stack smoke", model: "llama3.2", provider: "lmstudio" },
    });

    const claimed = await client.claimJob(["gpu"]);
    assert.ok(claimed);
    assert.equal(claimed.id, job.id);

    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          model: "llama3.2",
          choices: [{ message: { content: "Stack OK" } }],
        }),
        { status: 200 },
      )) as typeof fetch;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try {
      const result = await executeJob(claimed, {
        requestTimeoutMs: 5000,
        refreshModels: async () => 0,
        lmStudioUrl: "http://127.0.0.1:1234",
        resolveModelProvider: () => "lmstudio",
      });
      await client.completeJob(claimed.id, result);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const completed = await waitForConnectorJob(db, job.id, { intervalMs: 5, timeoutMs: 5000 });
    assert.equal(completed.status, "completed");
    assert.equal((completed.result as { text?: string }).text, "Stack OK");
  });
});
