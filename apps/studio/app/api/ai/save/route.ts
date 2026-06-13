import { postSave } from "../../../../src/lib/ai-handlers";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as {
    proposalId: string;
    mode: "idea" | "content_block" | "player_recap";
    title?: string;
    content?: string;
    sessionId?: string;
  };

  if (!body.proposalId || !body.mode) {
    return Response.json({ error: "proposalId und mode sind erforderlich." }, { status: 400 });
  }

  try {
    return await postSave(body);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Übernahme fehlgeschlagen." },
      { status: 500 },
    );
  }
}
