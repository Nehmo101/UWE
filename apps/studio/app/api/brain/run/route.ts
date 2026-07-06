import { postBrainRun } from "../../../../src/lib/brain-handlers";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { brainRunBodySchema, parseBody } from "@uwe/security";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, brainRunBodySchema);
  if (!parsed.success) return parsed.response;

  const user = await getCurrentAuthUser();
  return postBrainRun(parsed.data, user?.id ?? null);
}
