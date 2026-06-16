import { getModels } from "../../../../src/lib/ai-handlers";
import {
  aiModelsQuerySchema,
  parseQuery,
  requireStudioApiAuth,
  safeHandlerError,
} from "@uwe/security";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsed = parseQuery(request.url, aiModelsQuerySchema);
  if (!parsed.success) return parsed.response;

  const useMock = parsed.data.mock === "true";

  try {
    return await getModels(parsed.data.provider, useMock);
  } catch (error) {
    return safeHandlerError(error, "Modelle konnten nicht geladen werden.");
  }
}
