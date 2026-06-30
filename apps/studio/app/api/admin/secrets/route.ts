import { NextResponse } from "next/server";
import { canAccessSecurityDashboard } from "@uwe/auth";
import {
  assertSecretsStatusHasNoSecrets,
  getSecretsStatusSnapshot,
  prisma,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

/**
 * Read-only secrets status JSON — same data as /admin/secrets page.
 * Never returns plaintext secrets.
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

  const snapshot = await getSecretsStatusSnapshot(prisma);
  assertSecretsStatusHasNoSecrets(snapshot);

  return NextResponse.json(snapshot);
}
