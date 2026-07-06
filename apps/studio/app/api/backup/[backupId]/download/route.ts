import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getBackupDownload } from "../../../../../src/lib/backup-handlers";
import { idSchema, parseParams } from "@uwe/security";
import { z } from "zod";

const backupIdParamSchema = z.object({ backupId: idSchema });

interface Props {
  params: Promise<{ backupId: string }>;
}

export async function GET(request: Request, { params }: Props) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, backupIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  return getBackupDownload(decodeURIComponent(parsedParams.data.backupId));
}
