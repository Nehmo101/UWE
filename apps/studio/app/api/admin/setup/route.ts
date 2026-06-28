import { NextResponse } from "next/server";
import {
  assertOwnerSetupHasNoSecrets,
  getOwnerSetupSnapshot,
  prisma,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const snapshot = await getOwnerSetupSnapshot(prisma, {
    role: context.user?.role ?? "unknown",
    canEdit: context.user?.role === "owner",
  });
  assertOwnerSetupHasNoSecrets(snapshot);

  return NextResponse.json(snapshot);
}
