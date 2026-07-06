import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getRuns } from "../../../../src/lib/ai-handlers";
import { parseQuery, passthroughBodySchema } from "@uwe/security";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = parseQuery(request.url, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  const params = parsed.data as Record<string, unknown>;
  const worldSlug = typeof params.worldSlug === "string" ? params.worldSlug : undefined;
  const pageId = typeof params.pageId === "string" ? params.pageId : undefined;
  const gameSessionId =
    typeof params.gameSessionId === "string" ? params.gameSessionId : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const limit = typeof params.limit === "string" ? Number(params.limit) : undefined;
  const offset = typeof params.offset === "string" ? Number(params.offset) : undefined;

  return getRuns({ worldSlug, pageId, gameSessionId, status, limit, offset });
}
