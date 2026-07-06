import { postSave } from "../../../../src/lib/ai-handlers";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import { aiSaveBodySchema, parseBody, safeHandlerError } from "@uwe/security";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiSaveBodySchema);
  if (!parsed.success) return parsed.response;

  try {
    return await postSave(parsed.data);
  } catch (error) {
    return safeHandlerError(error, "Übernahme fehlgeschlagen.");
  }
}
