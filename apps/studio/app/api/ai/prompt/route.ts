import { postAiPrompt, type AiPromptRequestBody } from "@/src/lib/ai-prompt-handlers";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { aiPromptBodySchema, parseBody } from "@uwe/security";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiPromptBodySchema);
  if (!parsed.success) return parsed.response;

  const user = await getCurrentAuthUser();
  const gatewayUser = user ? { userId: user.id, role: user.role } : undefined;

  return postAiPrompt(parsed.data as unknown as AiPromptRequestBody, gatewayUser);
}
