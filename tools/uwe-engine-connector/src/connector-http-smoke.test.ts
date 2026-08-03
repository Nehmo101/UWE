/**
 * Live HTTP smoke — mock host server + HostClient + maintenance job cycle.
 * Proves the worker outbound HTTP path without a full Studio build.
 */

import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { describe, it } from "node:test";

import { HostClient } from "./host-client";

interface MockJob {
  id: string;
  type: string;
  lane: string;
  priority: number;
  payload: Record<string, unknown>;
  status: "pending" | "claimed" | "completed";
  claimedBy?: string;
  result?: Record<string, unknown>;
}

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

describe("connector HTTP live smoke", () => {
  it("heartbeat → claim → complete over HTTP", async () => {
    const connectorId = "conn-smoke-1";
    const token = "uwec_smoke_token";
    const jobs: MockJob[] = [
      {
        id: "job-refresh",
        type: "connector_refresh_models",
        lane: "maintenance",
        priority: 10,
        payload: {},
        status: "pending",
      },
    ];

    const server = createServer(async (req, res) => {
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${token}`) {
        sendJson(res, 401, { error: "unauthorized" });
        return;
      }

      if (req.method === "POST" && req.url === "/api/connectors/heartbeat") {
        sendJson(res, 200, {
          connector: { id: connectorId, name: "Smoke", status: "online", queueEnabled: true },
          config: {
            pollIntervalMs: 500,
            heartbeatIntervalMs: 5000,
            queueEnabled: true,
            cloudFallbackAllowed: false,
            capabilities: ["system_info"],
            jobTypes: ["connector_refresh_models"],
          },
          activeJobIds: [],
        });
        return;
      }

      if (req.method === "POST" && req.url === "/api/connectors/claim-job") {
        const body = await readJson(req);
        const lanes = Array.isArray(body.availableLanes) ? body.availableLanes : [];
        const job = jobs.find(
          (entry) => entry.status === "pending" && lanes.includes(entry.lane),
        );
        if (!job) {
          sendJson(res, 200, { job: null });
          return;
        }
        job.status = "claimed";
        job.claimedBy = connectorId;
        sendJson(res, 200, {
          job: {
            id: job.id,
            type: job.type,
            lane: job.lane,
            priority: job.priority,
            payload: job.payload,
            worldId: null,
            expiresAt: null,
          },
        });
        return;
      }

      const completeMatch = req.url?.match(/^\/api\/connectors\/jobs\/([^/]+)\/complete$/);
      if (req.method === "POST" && completeMatch) {
        const jobId = completeMatch[1];
        const body = await readJson(req);
        const job = jobs.find((entry) => entry.id === jobId);
        if (!job) {
          sendJson(res, 404, { error: "missing" });
          return;
        }
        job.status = "completed";
        job.result = (body.result as Record<string, unknown>) ?? {};
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: "not found" });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const client = new HostClient(baseUrl, token);

    try {
      await client.heartbeat({
        capabilities: ["system_info"],
        models: [],
        version: "smoke",
        queueEnabled: true,
        currentJobs: 0,
        lastError: null,
      });

      const claimed = await client.claimJob(["maintenance"]);
      assert.ok(claimed);
      assert.equal(claimed.type, "connector_refresh_models");

      await client.completeJob(claimed.id, { refreshed: true, modelCount: 0 });
      assert.equal(jobs[0]?.status, "completed");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
