import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { requireAdminAccess } from "@/src/lib/auth";
import { jsonError } from "@/src/lib/api-response";

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

/** @deprecated Use jsonError from @/src/lib/api-response */
export const mailApiError = jsonError;
