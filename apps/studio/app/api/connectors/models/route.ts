import { NextResponse } from "next/server";

import { createConnectorService, prisma, toConnectorView } from "@uwe/database/server";

import { authenticateConnector } from "@/src/lib/connector-auth";

/**
 * Returns the models the host currently knows about for this connector, plus
 * whether a model refresh has been requested via the queue. The connector
 * reports its model list through the heartbeat; this endpoint lets it confirm
 * what the host has on record.
 */
export async function GET(request: Request) {
  const auth = await authenticateConnector(request);
  if (!auth.ok) return auth.response;

  const view = toConnectorView(auth.connector);

  const service = createConnectorService(prisma);
  const active = await service.listActiveJobs(auth.connector.id);
  const refreshRequested = active.some((job) => job.type === "connector_refresh_models");

  return NextResponse.json({
    models: view.models,
    refreshRequested,
  });
}
