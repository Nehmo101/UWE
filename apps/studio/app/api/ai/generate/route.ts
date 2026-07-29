import { postGenerate } from "../../../../src/lib/ai-handlers";
import { guardStudioApiRequestWithContext } from "@/src/lib/studio-admin-auth";
import { aiGenerateBodySchema, parseBody } from "@uwe/security";

export async function POST(request: Request) {
  const { error: authError, context } = await guardStudioApiRequestWithContext(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiGenerateBodySchema);
  if (!parsed.success) return parsed.response;

  const user = context.user;
  return postGenerate(parsed.data, user?.id ?? null);
}
