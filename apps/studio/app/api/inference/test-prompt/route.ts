import { runInferenceTestPrompt } from "@uwe/ai-brain";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { inferenceTestPromptBodySchema, parseBody } from "@uwe/security";

/**
 * Maschinenraum inference smoke test — no secrets in response.
 */
export async function POST(request: Request) {
  const authError = await guardStudioApiRequest(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, inferenceTestPromptBodySchema);
  if (!parsed.success) return parsed.response;

  const { searchParams } = new URL(request.url);
  const useMock = parsed.data.mock === true || searchParams.get("mock") === "true";

  const test = await runInferenceTestPrompt({
    prompt: parsed.data.prompt,
    model: parsed.data.model,
    useMock,
  });

  return Response.json({ test }, { status: test.ok ? 200 : 503 });
}
