import { NextResponse } from "next/server";
import { canAccessSecurityDashboard } from "@uwe/auth";
import {
  assertSecurityDashboardHasNoSecrets,
  getSecurityDashboardStatus,
  prisma,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

/**
 * Security dashboard JSON — same data as /admin/security page.
 * Requires OWNER/ADMIN session or scoped API token.
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
    return NextResponse.json({ error: "Nur OWNER/ADMIN dürfen das Security Dashboard sehen." }, { status: 403 });
  }

  const status = await getSecurityDashboardStatus(prisma);
  assertSecurityDashboardHasNoSecrets(status);

  return NextResponse.json(status);
}
