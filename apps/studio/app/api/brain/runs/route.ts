import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getBrainRuns } from "../../../../src/lib/brain-handlers";
import { parseQuery, passthroughBodySchema } from "@uwe/security";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = parseQuery(request.url, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  const params = parsed.data as Record<string, unknown>;
  const worldSlug = typeof params.worldSlug === "string" ? params.worldSlug : undefined;
  const pageSlug = typeof params.pageSlug === "string" ? params.pageSlug : undefined;
  const limit =
    typeof params.limit === "string" ? Number.parseInt(params.limit, 10) : undefined;

  return getBrainRuns({ worldSlug, pageSlug, limit });
}
