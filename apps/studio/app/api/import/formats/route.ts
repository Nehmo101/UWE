import { getImportFormats } from "../../../../src/lib/import-handlers";
import { requireStudioApiAuth, safeHandlerError } from "@uwe/security";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  try {
    return await getImportFormats();
  } catch (error) {
    return safeHandlerError(error, "Formate konnten nicht geladen werden.");
  }
}
