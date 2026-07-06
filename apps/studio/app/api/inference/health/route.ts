import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getInferenceStatus, runInferenceTestPrompt } from "@uwe/ai-brain";
import { inferenceHealthQuerySchema, parseQuery } from "@uwe/security";

/**
 * RTX inference health — no secrets, only reachability and config facts.
 */
export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = parseQuery(request.url, inferenceHealthQuerySchema);
  if (!parsed.success) return parsed.response;

  const useMock = parsed.data.mock === "true";
  const runTest = parsed.data.test === "true";

  const status = await getInferenceStatus({ useMock });

  if (runTest) {
    const test = await runInferenceTestPrompt({ useMock });
    return Response.json(
      {
        inference: status,
        test,
      },
      { status: status.online && test.ok ? 200 : 503 },
    );
  }

  return Response.json(
    { inference: status },
    { status: status.enabled && status.online ? 200 : status.enabled ? 503 : 200 },
  );
}
