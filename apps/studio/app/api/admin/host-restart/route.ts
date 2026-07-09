import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  auditRequestFromHeaders,
  createAuditLogService,
  createPrismaClient,
} from "@uwe/database/server";
import {
  HostRestartError,
  resolveHostRestartAvailability,
  triggerHostRestart,
} from "@uwe/database/host-restart";
import { requireOwnerApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireOwnerApiAuth(request, context, { rateLimit: "setup" });
  if (authError) {
    return authError;
  }

  const availability = await resolveHostRestartAvailability();
  return NextResponse.json({ availability });
}

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireOwnerApiAuth(request, context, { rateLimit: "hostRestart" });
  if (authError) {
    return authError;
  }

  if (!context.user) {
    return jsonError("Owner-Session erforderlich.", 401);
  }

  const db = createPrismaClient();
  try {
    await triggerHostRestart();

    const audit = createAuditLogService(db);
    await audit.log({
      actorUserId: context.user.id,
      action: "host_restart_started",
      targetType: "system",
      targetId: "uwe.service",
      request: auditRequestFromHeaders(request.headers),
      metadata: {
        trigger: "studio_host_control",
      },
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    if (error instanceof HostRestartError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Host-Neustart konnte nicht ausgeführt werden.", 500);
  } finally {
    await db.$disconnect();
  }
}
