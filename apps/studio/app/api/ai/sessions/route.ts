import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getSessions } from "../../../../src/lib/ai-handlers";
import { aiSessionsQuerySchema, parseQuery, safeHandlerError } from "@uwe/security";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = parseQuery(request.url, aiSessionsQuerySchema);
  if (!parsed.success) return parsed.response;

  try {
    return await getSessions(parsed.data.worldSlug, parsed.data.pageSlug);
  } catch (error) {
    return safeHandlerError(error, "Sessions konnten nicht geladen werden.");
  }
}
