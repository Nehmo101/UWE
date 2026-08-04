import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getRuns } from "../../../../src/lib/ai-handlers";
import { aiRunsQuerySchema, parseQuery } from "@uwe/security";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = parseQuery(request.url, aiRunsQuerySchema);
  if (!parsed.success) return parsed.response;

  return getRuns(parsed.data);
}
