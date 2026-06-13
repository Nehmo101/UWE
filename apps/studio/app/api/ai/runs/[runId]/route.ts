import { getRun, patchRun } from "../../../../../src/lib/ai-handlers";
import { requireStudioApiAuth } from "../../../../../src/lib/studio-api-auth";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { runId } = await context.params;
  return getRun(runId);
}

export async function PATCH(request: Request, context: RouteContext) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { runId } = await context.params;
  const body = (await request.json()) as { status: "applied" | "discarded" | "cancelled" };

  if (!body.status) {
    return Response.json({ error: "status ist erforderlich." }, { status: 400 });
  }

  return patchRun(runId, body);
}
