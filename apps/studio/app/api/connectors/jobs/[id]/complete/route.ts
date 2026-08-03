import { NextResponse } from "next/server";
import { z } from "zod";

import { createConnectorService, prisma } from "@uwe/database/server";
import { idSchema, parseBody, parseParams } from "@uwe/security";

import { authenticateConnector } from "@/src/lib/connector-auth";

const paramSchema = z.object({ id: idSchema });
const bodySchema = z.object({
  result: z.record(z.string(), z.unknown()).nullable().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await authenticateConnector(request);
  if (!auth.ok) return auth.response;

  const parsedParams = await parseParams(context.params, paramSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.success) return parsed.response;

  const service = createConnectorService(prisma);
  const job = await service.completeJob(
    parsedParams.data.id,
    auth.connector.id,
    parsed.data.result ?? null,
  );

  if (!job) {
    return NextResponse.json(
      { error: "Job nicht gefunden, nicht beansprucht oder bereits abgeschlossen." },
      { status: 409 },
    );
  }

  return NextResponse.json({ job: { id: job.id, status: job.status } });
}
