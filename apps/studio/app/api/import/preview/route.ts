import { postImportPreview } from "../../../../src/lib/import-handlers";
import {
  guardStudioMutation,
  importPreviewBodySchema,
  parseBody,
  safeHandlerError,
} from "@uwe/security";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "import" });
  if (authError) return authError;

  const parsed = await parseBody(request, importPreviewBodySchema);
  if (!parsed.success) return parsed.response;

  try {
    return await postImportPreview(parsed.data);
  } catch (error) {
    return safeHandlerError(error, "Import-Vorschau fehlgeschlagen.");
  }
}
