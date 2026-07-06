import { postGenerate } from "../../../../src/lib/ai-handlers";
import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { aiGenerateBodySchema, parseBody } from "@uwe/security";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiGenerateBodySchema);
  if (!parsed.success) return parsed.response;

  const user = await getCurrentAuthUser();
  return postGenerate(parsed.data, user?.id ?? null);
}
