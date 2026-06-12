import { getBackupDownload } from "../../../../../src/lib/backup-handlers";
import { requireStudioApiAuth } from "../../../../../src/lib/studio-api-auth";

interface Props {
  params: Promise<{ backupId: string }>;
}

export async function GET(request: Request, { params }: Props) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { backupId } = await params;
  return getBackupDownload(decodeURIComponent(backupId));
}
