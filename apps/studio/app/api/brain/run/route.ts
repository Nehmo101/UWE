import { postBrainRun } from "../../../../src/lib/brain-handlers";
import { guardStudioApiRequestWithContext } from "@/src/lib/studio-admin-auth";
import { brainRunBodySchema, parseBody } from "@uwe/security";

export async function POST(request: Request) {
  const { error: authError, context } = await guardStudioApiRequestWithContext(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, brainRunBodySchema);
  if (!parsed.success) return parsed.response;

  const user = context.user;
  return postBrainRun(parsed.data, user?.id ?? null);
}
