import { postDiscard } from "../../../../../src/lib/ai-handlers";
import { requireStudioApiAuth } from "../../../../../src/lib/studio-api-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as { proposalId: string; reason?: string };

  if (!body.proposalId) {
    return Response.json({ error: "proposalId ist erforderlich." }, { status: 400 });
  }

  return postDiscard(body);
}
