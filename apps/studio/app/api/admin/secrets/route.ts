import { NextResponse } from "next/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { canAccessSecurityDashboard } from "@uwe/auth";
import {
  assertSecretsStatusHasNoSecrets,
  getSecretsStatusSnapshot,
  logAuditEvent,
  prisma,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

/**
 * Read-only secrets status JSON — same data as /admin/secrets page.
 * Never returns plaintext secrets. Access is audit-logged.
 */
export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) {
    return authError;
  }

  if (context.authMethod === "session" && context.user && !canAccessSecurityDashboard(context.user.role)) {
    return NextResponse.json(
      { error: "Nur OWNER/ADMIN dürfen den Secrets-Status sehen." },
      { status: 403 },
    );
  }

  const snapshot = await getSecretsStatusSnapshot(prisma, brainPrisma);
  assertSecretsStatusHasNoSecrets(snapshot);

  await logAuditEvent(prisma, {
    actorUserId: context.user?.id ?? null,
    action: "secret_status_viewed",
    targetType: "settings",
    targetId: "secrets-status",
    request: {
      ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    },
    metadata: {
      authMethod: context.authMethod,
      apiTokenId: context.apiTokenId ?? null,
      rotationDueCount: snapshot.rotationDueSecretIds.length,
      criticalWarnings: snapshot.warnings.filter((warning) => warning.severity === "critical").length,
    },
  });

  return NextResponse.json(snapshot);
}
