import { postGeneratorAction } from "@/src/lib/generator-handlers";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import { aiGeneratorBodySchema, parseBody } from "@uwe/security";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiGeneratorBodySchema);
  if (!parsed.success) return parsed.response;

  return postGeneratorAction(parsed.data);
}
