import { NextResponse } from "next/server";
import { z } from "zod";

import { CONNECTOR_LANES } from "@uwe/connector";
import { createConnectorService, prisma } from "@uwe/database/server";
import { parseBody } from "@uwe/security";

import { authenticateConnector } from "@/src/lib/connector-auth";
import { resolveHostConnectorConfig } from "@/src/lib/connector-config";

const claimSchema = z.object({
  availableLanes: z.array(z.enum(CONNECTOR_LANES)).min(1).max(CONNECTOR_LANES.length),
});

export async function POST(request: Request) {
  // Host-wide kill switch — connectors stop receiving work when the host
  // queue is disabled, even if the connector itself is enabled. Keep this
  // before authentication so an emergency pause does not touch the database.
  if (!resolveHostConnectorConfig().queueEnabled) {
    return NextResponse.json({ job: null, reason: "host_queue_disabled" });
  }

  const auth = await authenticateConnector(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(request, claimSchema);
  if (!parsed.success) return parsed.response;

  const service = createConnectorService(prisma);
  const job = await service.claimJob({
    connectorId: auth.connector.id,
    availableLanes: parsed.data.availableLanes,
  });

  if (!job) {
    return NextResponse.json({ job: null });
  }

  // Only job-specific context is returned — never world/brain/user data.
  return NextResponse.json({
    job: {
      id: job.id,
      type: job.type,
      lane: job.lane,
      priority: job.priority,
      payload: job.payload ?? {},
      worldId: job.worldId,
      expiresAt: job.expiresAt,
    },
  });
}
