import { getBrainRuns } from "../../../../src/lib/brain-handlers";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const worldSlug = url.searchParams.get("worldSlug") ?? undefined;
  const pageSlug = url.searchParams.get("pageSlug") ?? undefined;
  const limit = url.searchParams.get("limit")
    ? Number.parseInt(url.searchParams.get("limit")!, 10)
    : undefined;

  return getBrainRuns({ worldSlug, pageSlug, limit });
}
