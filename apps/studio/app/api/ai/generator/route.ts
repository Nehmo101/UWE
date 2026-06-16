import { postGeneratorAction } from "@/src/lib/generator-handlers";
import {
  aiGeneratorBodySchema,
  guardStudioMutation,
  parseBody,
} from "@uwe/security";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiGeneratorBodySchema);
  if (!parsed.success) return parsed.response;

  return postGeneratorAction(parsed.data);
}
