import { postGenerate } from "../../../../src/lib/ai-handlers";
import { getCurrentAuthUser } from "@/src/lib/auth";
import {
  aiGenerateBodySchema,
  guardStudioMutation,
  parseBody,
} from "@uwe/security";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiGenerateBodySchema);
  if (!parsed.success) return parsed.response;

  const user = await getCurrentAuthUser();
  return postGenerate(parsed.data, user?.id ?? null);
}
