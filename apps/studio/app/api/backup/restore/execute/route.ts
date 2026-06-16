import { postRestoreExecute } from "../../../../../src/lib/backup-handlers";
import {
  guardStudioMutation,
  passthroughBodySchema,
  parseBody,
  requireRestoreOwnerAuth,
} from "@uwe/security";

export async function POST(request: Request) {
  const authError = requireRestoreOwnerAuth(request);
  if (authError) return authError;

  const parsed = await parseBody(request, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  return postRestoreExecute(parsed.data);
}
