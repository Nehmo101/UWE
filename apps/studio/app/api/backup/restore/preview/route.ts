import { postRestorePreview } from "../../../../../src/lib/backup-handlers";
import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { passthroughBodySchema, parseBody } from "@uwe/security";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "setup" });
  if (authError) return authError;

  const parsed = await parseBody(request, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  return postRestorePreview(parsed.data);
}
