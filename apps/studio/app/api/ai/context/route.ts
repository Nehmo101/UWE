import { postContext } from "../../../../src/lib/ai-handlers";
import type { AiTaskType } from "@uwe/ai-brain";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    taskType: AiTaskType;
    worldSlug: string;
    pageSlug: string;
    allowDmOnly?: boolean;
  };

  if (!body.taskType || !body.worldSlug || !body.pageSlug) {
    return Response.json({ error: "taskType, worldSlug und pageSlug sind erforderlich." }, { status: 400 });
  }

  try {
    return await postContext(body);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Kontext konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
