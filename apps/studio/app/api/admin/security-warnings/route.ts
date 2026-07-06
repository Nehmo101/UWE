import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createSecurityWarningService,
  getSecurityDashboardStatus,
  prisma,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { requireAdminAccess } from "@/src/lib/auth";

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const status = await getSecurityDashboardStatus(prisma);
  const service = createSecurityWarningService(prisma);
  await service.syncRuntimeWarnings(status.warnings);
  const persisted = await service.listActive();

  return NextResponse.json({
    runtime: status.warnings,
    persisted,
    publicExposure: status.publicRoutes,
  });
}

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const user = context.user ?? (await requireAdminAccess());
  const body = (await request.json()) as { code?: string };
  if (!body.code?.trim()) {
    return jsonError("code erforderlich.", 400);
  }

  const service = createSecurityWarningService(prisma);
  await service.dismiss(body.code.trim(), user.id);

  return NextResponse.json({ ok: true });
}
