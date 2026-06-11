import { postContext } from "../../../../src/lib/ai-handlers";
import type { AiTaskType } from "@uwe/ai-brain";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    taskType: AiTaskType;
    worldSlug: string;
    pageSlug: string;
    allowDmOnly?: boolean;
    sessionId?: string;
  };

  if (!body.taskType || !body.worldSlug || !body.pageSlug) {
    return Response.json({ error: "taskType, worldSlug und pageSlug sind erforderlich." }, { status: 400 });
  }

  return postContext(body);
}
