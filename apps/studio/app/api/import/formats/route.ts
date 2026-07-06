import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getImportFormats } from "../../../../src/lib/import-handlers";
import { safeHandlerError } from "@uwe/security";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  try {
    return await getImportFormats();
  } catch (error) {
    return safeHandlerError(error, "Formate konnten nicht geladen werden.");
  }
}
