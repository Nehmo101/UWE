import { NextResponse } from "next/server";
import { z } from "zod";

import { createConnectorService, prisma } from "@uwe/database/server";
import { parseBody, requireAdminApiAuth } from "@uwe/security";

import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { resolveHostConnectorConfig } from "@/src/lib/connector-config";

const createSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const service = createConnectorService(prisma);
  const [connectors, recentJobs, pendingByLane] = await Promise.all([
    service.listConnectors(),
    service.listJobs({ limit: 25 }),
    service.countPendingByLane(),
  ]);

  return NextResponse.json({
    connectors,
    recentJobs,
    pendingByLane,
    hostConfig: resolveHostConnectorConfig(),
  });
}

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const parsed = await parseBody(request, createSchema);
  if (!parsed.success) return parsed.response;

  const service = createConnectorService(prisma);
  const { connector, token } = await service.createConnector(parsed.data.name);

  return NextResponse.json(
    {
      connector,
      token,
      warning:
        "Das Connector-Token wird nur einmal angezeigt. Trage es als UWE_CONNECTOR_TOKEN im RTX Connector ein — es wird nicht erneut ausgegeben.",
    },
    { status: 201 },
  );
}
