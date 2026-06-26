import { getBackupList, getBackupPermissions, postBackupCreate, type BackupCreateBody } from "../../../src/lib/backup-handlers";
import {
  guardStudioMutation,
  passthroughBodySchema,
  parseBody,
  requireStudioApiAuth,
} from "@uwe/security";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  if (url.searchParams.get("permissions") === "1") {
    return getBackupPermissions(request);
  }

  return getBackupList();
}

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "setup" });
  if (authError) return authError;

  const parsed = await parseBody(request, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  return postBackupCreate(parsed.data as unknown as BackupCreateBody);
}
