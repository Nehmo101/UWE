import { getBackupDownload } from "../../../../../src/lib/backup-handlers";

interface Props {
  params: Promise<{ backupId: string }>;
}

export async function GET(_request: Request, { params }: Props) {
  const { backupId } = await params;
  return getBackupDownload(decodeURIComponent(backupId));
}
