import { postRestorePreview } from "../../../../../src/lib/backup-handlers";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { passthroughBodySchema, parseBody, requireOwnerApiAuth } from "@uwe/security";

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireOwnerApiAuth(request, context, { rateLimit: "setup" });
  if (authError) return authError;

  const parsed = await parseBody(request, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  return postRestorePreview(parsed.data);
}
