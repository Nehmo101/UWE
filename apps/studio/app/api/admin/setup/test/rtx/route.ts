import { NextResponse } from "next/server";
import { getInferenceStatus, runInferenceTestPrompt } from "@uwe/ai-brain";
import { requireOwnerApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireOwnerApiAuth(request, context, { rateLimit: "setup" });
  if (authError) return authError;

  const useMock = process.env.AI_USE_MOCK === "true";
  const status = await getInferenceStatus({ useMock });
  const test = await runInferenceTestPrompt({ useMock });

  const ok = status.online && test.ok;
  return NextResponse.json(
    {
      ok,
      message: ok
        ? `RTX erreichbar (${test.model}, ${test.latencyMs} ms).`
        : status.message || test.message,
      inference: {
        enabled: status.enabled,
        online: status.online,
        endpoint: status.endpoint,
        provider: status.providerId,
      },
      test: {
        ok: test.ok,
        model: test.model,
        latencyMs: test.latencyMs,
        message: test.message,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
