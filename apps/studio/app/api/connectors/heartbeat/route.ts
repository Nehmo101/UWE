import { NextResponse } from "next/server";
import { z } from "zod";

import { CONNECTOR_CAPABILITIES, CONNECTOR_MODEL_TYPES, normalizeLocalPrinters } from "@uwe/connector";
import { createConnectorService, prisma } from "@uwe/database/server";
import { parseBody } from "@uwe/security";

import { authenticateConnector } from "@/src/lib/connector-auth";
import { resolveHostConnectorConfig } from "@/src/lib/connector-config";

const modelSchema = z.object({
  provider: z.string().max(64),
  name: z.string().max(200),
  status: z.string().max(32).optional(),
  contextLength: z.number().int().nonnegative().optional(),
  capabilities: z.array(z.string().max(32)).max(16).optional(),
  displayName: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  bestFor: z.array(z.string().max(60)).max(16).optional(),
  modelType: z.enum(CONNECTOR_MODEL_TYPES).optional(),
  enabledForUwe: z.boolean().optional(),
});

const heartbeatSchema = z.object({
  capabilities: z.array(z.enum(CONNECTOR_CAPABILITIES)).max(16).optional(),
  models: z.array(modelSchema).max(200).optional(),
  printers: z.array(z.object({ id: z.string().max(120), name: z.string().max(200), isDefault: z.boolean().optional(), state: z.string().max(64).optional() })).max(50).optional(),
  version: z.string().max(64).nullable().optional(),
  queueEnabled: z.boolean().optional(),
  currentJobs: z.number().int().nonnegative().max(10_000).optional(),
  lastError: z.string().max(1000).nullable().optional(),
});

export async function POST(request: Request) {
  const pausedHostConfig = resolveHostConnectorConfig();
  if (!pausedHostConfig.queueEnabled) {
    return NextResponse.json({
      connector: {
        id: "host-queue-paused",
        name: "UWE Host Queue",
        status: "offline",
        queueEnabled: false,
      },
      config: pausedHostConfig,
      activeJobIds: [],
    });
  }

  const auth = await authenticateConnector(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, heartbeatSchema);
  if (!parsed.success) return parsed.response;

  const service = createConnectorService(prisma);
  const view = await service.heartbeat(auth.connector.id, {
    capabilities: parsed.data.capabilities,
    models: parsed.data.models,
    printers: parsed.data.printers ? normalizeLocalPrinters(parsed.data.printers) : undefined,
    version: parsed.data.version,
    queueEnabled: parsed.data.queueEnabled,
    currentJobs: parsed.data.currentJobs,
    lastError: parsed.data.lastError,
  });

  const hostConfig = resolveHostConnectorConfig();
  const activeJobs = await service.listActiveJobs(auth.connector.id);

  return NextResponse.json({
    connector: {
      id: view.id,
      name: view.name,
      status: view.status,
      queueEnabled: view.queueEnabled && hostConfig.queueEnabled,
    },
    config: hostConfig,
    activeJobIds: activeJobs.map((job) => job.id),
  });
}
