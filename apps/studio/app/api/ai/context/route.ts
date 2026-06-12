import { postContext } from "../../../../src/lib/ai-handlers";
import type { AiTaskType } from "@uwe/ai-brain";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

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
