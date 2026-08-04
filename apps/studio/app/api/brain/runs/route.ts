import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getBrainRuns } from "../../../../src/lib/brain-handlers";
import { brainRunsQuerySchema, parseQuery } from "@uwe/security";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = parseQuery(request.url, brainRunsQuerySchema);
  if (!parsed.success) return parsed.response;

  return getBrainRuns(parsed.data);
}
