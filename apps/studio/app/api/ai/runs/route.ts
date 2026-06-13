import { getRuns } from "../../../../src/lib/ai-handlers";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const worldSlug = url.searchParams.get("worldSlug") ?? undefined;
  const pageId = url.searchParams.get("pageId") ?? undefined;
  const gameSessionId = url.searchParams.get("gameSessionId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
  const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined;

  return getRuns({ worldSlug, pageId, gameSessionId, status, limit, offset });
}
