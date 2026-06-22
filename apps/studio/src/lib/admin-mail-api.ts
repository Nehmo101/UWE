import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { requireAdminAccess } from "@/src/lib/auth";

export async function requireAdminMailApi(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["mail_read"],
  });
  if (authError) return { error: authError, context: null, user: null };

  const user = context.user ?? (await requireAdminAccess());
  return { error: null, context, user };
}

export async function requireAdminMailMutation(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["mail_send"],
  });
  if (authError) return { error: authError, context: null, user: null };

  const user = context.user ?? (await requireAdminAccess());
  return { error: null, context, user };
}

export function mailApiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
