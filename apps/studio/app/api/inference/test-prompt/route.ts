import { runInferenceTestPrompt } from "@uwe/ai-brain";

/**
 * RTX inference smoke test — no secrets in response.
 */
export async function POST(request: Request) {
  let prompt: string | undefined;
  let model: string | undefined;
  let useMock = false;

  try {
    const body = (await request.json()) as {
      prompt?: unknown;
      model?: unknown;
      mock?: unknown;
    };
    if (typeof body.prompt === "string") {
      prompt = body.prompt;
    }
    if (typeof body.model === "string") {
      model = body.model;
    }
    if (body.mock === true) {
      useMock = true;
    }
  } catch {
    // empty body is fine — defaults apply
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("mock") === "true") {
    useMock = true;
  }

  const test = await runInferenceTestPrompt({ prompt, model, useMock });

  return Response.json({ test }, { status: test.ok ? 200 : 503 });
}
