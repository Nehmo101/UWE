import { getInferenceStatus, runInferenceTestPrompt } from "@uwe/ai-brain";

/**
 * RTX inference health — no secrets, only reachability and config facts.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const useMock = searchParams.get("mock") === "true";
  const runTest = searchParams.get("test") === "true";

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
