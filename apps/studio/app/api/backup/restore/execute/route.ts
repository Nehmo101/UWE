import { postRestoreExecute } from "../../../../../src/lib/backup-handlers";
import {
  backupRestoreBodySchema,
  parseBody,
  requireRestoreOwnerAuth,
} from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireRestoreOwnerAuth(request, context);
  if (authError) return authError;

  const parsed = await parseBody(request, backupRestoreBodySchema);
  if (!parsed.success) return parsed.response;

  return postRestoreExecute(parsed.data);
}
