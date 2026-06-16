import { NextResponse } from "next/server";
import { canAccessSecurityDashboard, SESSION_COOKIE_NAME } from "@uwe/auth";
import {
  assertSecurityDashboardHasNoSecrets,
  createAuthService,
  getSecurityDashboardStatus,
  prisma,
} from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

/**
 * Security dashboard JSON — same data as /admin/security page.
 * Requires OWNER/ADMIN portal session in addition to Studio API guard.
 */
export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) {
    return authError;
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Portal-Login erforderlich (OWNER/ADMIN)." }, { status: 403 });
  }

  const session = await createAuthService(prisma).getSessionByToken(token);
  if (!session || !canAccessSecurityDashboard(session.user.role)) {
    return NextResponse.json({ error: "Nur OWNER/ADMIN dürfen das Security Dashboard sehen." }, { status: 403 });
  }

  const status = await getSecurityDashboardStatus(prisma);
  assertSecurityDashboardHasNoSecrets(status);

  return NextResponse.json(status);
}
