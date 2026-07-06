import { postImportExecute } from "../../../../src/lib/import-handlers";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import { importExecuteBodySchema, parseBody, safeHandlerError } from "@uwe/security";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "import" });
  if (authError) return authError;

  const parsed = await parseBody(request, importExecuteBodySchema);
  if (!parsed.success) return parsed.response;

  try {
    return await postImportExecute(parsed.data);
  } catch (error) {
    return safeHandlerError(error, "Import fehlgeschlagen.");
  }
}
