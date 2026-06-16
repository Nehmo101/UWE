import { postBrainRun } from "../../../../src/lib/brain-handlers";
import {
  brainRunBodySchema,
  guardStudioMutation,
  parseBody,
} from "@uwe/security";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, brainRunBodySchema);
  if (!parsed.success) return parsed.response;

  return postBrainRun(parsed.data);
}
