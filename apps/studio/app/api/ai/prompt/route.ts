import { postAiPrompt, type AiPromptRequestBody } from "@/src/lib/ai-prompt-handlers";
import { guardStudioApiRequestWithContext } from "@/src/lib/studio-admin-auth";
import { aiPromptBodySchema, parseBody } from "@uwe/security";

export async function POST(request: Request) {
  const { error: authError, context } = await guardStudioApiRequestWithContext(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiPromptBodySchema);
  if (!parsed.success) return parsed.response;

  const user = context.user;
  const gatewayUser = user ? { userId: user.id } : undefined;

  return postAiPrompt(parsed.data as unknown as AiPromptRequestBody, gatewayUser);
}
