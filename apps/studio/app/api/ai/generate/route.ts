import { postGenerate } from "../../../../src/lib/ai-handlers";
import type { AiProviderId, AiTaskType } from "@uwe/ai-brain";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    taskType: AiTaskType;
    worldSlug: string;
    pageSlug: string;
    providerId: AiProviderId;
    model: string;
    userPrompt?: string;
    allowDmOnly?: boolean;
    useMock?: boolean;
  };

  if (!body.taskType || !body.worldSlug || !body.pageSlug || !body.providerId || !body.model) {
    return Response.json(
      { error: "taskType, worldSlug, pageSlug, providerId und model sind erforderlich." },
      { status: 400 },
    );
  }

  try {
    return await postGenerate(body);
  } catch (error) {
    const status = error instanceof Error && error.name === "AiPrivacyError" ? 403 : 500;
    return Response.json(
      { error: error instanceof Error ? error.message : "Generierung fehlgeschlagen." },
      { status },
    );
  }
}
