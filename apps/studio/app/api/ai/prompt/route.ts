import { postAiPrompt, type AiPromptRequestBody } from "@/src/lib/ai-prompt-handlers";
import {
  aiPromptBodySchema,
  guardStudioMutation,
  parseBody,
} from "@uwe/security";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiPromptBodySchema);
  if (!parsed.success) return parsed.response;

  return postAiPrompt(parsed.data as unknown as AiPromptRequestBody);
}
