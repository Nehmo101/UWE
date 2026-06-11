import { postSave } from "../../../../src/lib/ai-handlers";
import type { AiContextSource, AiProviderId, AiTaskType } from "@uwe/ai-brain";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    mode: "idea" | "content_block" | "player_recap";
    taskType: AiTaskType;
    worldSlug: string;
    pageSlug: string;
    title?: string;
    content: string;
    providerId: AiProviderId;
    model: string;
    sessionId?: string;
    sources?: AiContextSource[];
  };

  if (!body.mode || !body.content || !body.worldSlug || !body.pageSlug) {
    return Response.json(
      { error: "mode, content, worldSlug und pageSlug sind erforderlich." },
      { status: 400 },
    );
  }

  try {
    return await postSave(body);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }
}
