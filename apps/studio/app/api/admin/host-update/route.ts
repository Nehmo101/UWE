import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  auditRequestFromHeaders,
  createAuditLogService,
  createPrismaClient,
  getHostUpdateDashboard,
  HostUpdateError,
  triggerHostUpdate,
} from "@uwe/database/server";
import { requireAdminApiAuth, requireOwnerApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const fetchRemote = url.searchParams.get("fetchRemote") === "1";

  const dashboard = await getHostUpdateDashboard({ fetchRemote });
  return NextResponse.json(dashboard);
}

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireOwnerApiAuth(request, context, { rateLimit: "hostUpdate" });
  if (authError) {
    return authError;
  }

  if (!context.user) {
    return jsonError("Owner-Session erforderlich.", 401);
  }

  const db = createPrismaClient();
  try {
    const result = await triggerHostUpdate({ actorUserId: context.user.id });

    const audit = createAuditLogService(db);
    await audit.log({
      actorUserId: context.user.id,
      action: "host_update_started",
      targetType: "system",
      targetId: result.jobId,
      request: auditRequestFromHeaders(request.headers),
      metadata: {
        jobId: result.jobId,
      },
    });

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof HostUpdateError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Host-Update konnte nicht gestartet werden.", 500);
  } finally {
    await db.$disconnect();
  }
}
