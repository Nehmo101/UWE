import { NextResponse } from "next/server";
import { createWebhookService, prisma } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["webhooks_manage"],
  });
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const endpointId = searchParams.get("endpointId") ?? undefined;
  const failedOnly = searchParams.get("failedOnly") === "1";
  const limit = Number(searchParams.get("limit") ?? "25");
  const offset = Number(searchParams.get("offset") ?? "0");

  const service = createWebhookService(prisma);
  const result = await service.listDeliveries({
    endpointId,
    failedOnly,
    limit: Number.isFinite(limit) ? limit : 25,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return NextResponse.json({
    deliveries: result.deliveries.map((delivery) => ({
      ...delivery,
      createdAt: delivery.createdAt.toISOString(),
      completedAt: delivery.completedAt?.toISOString() ?? null,
    })),
    total: result.total,
  });
}
