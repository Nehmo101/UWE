import { postRestoreExecute } from "../../../../../src/lib/backup-handlers";
import { requireStudioApiAuth } from "../../../../../src/lib/studio-api-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const body = await request.json();
  return postRestoreExecute(body);
}
