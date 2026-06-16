import { postRestorePreview } from "../../../../../src/lib/backup-handlers";
import {
  guardStudioMutation,
  passthroughBodySchema,
  parseBody,
} from "@uwe/security";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "setup" });
  if (authError) return authError;

  const parsed = await parseBody(request, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  return postRestorePreview(parsed.data);
}
