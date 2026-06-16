import { postDiscard } from "../../../../../src/lib/ai-handlers";
import {
  guardStudioMutation,
  idSchema,
  optionalString,
  parseBody,
} from "@uwe/security";
import { z } from "zod";

const aiDiscardBodySchema = z.object({
  proposalId: idSchema,
  reason: optionalString,
});

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiDiscardBodySchema);
  if (!parsed.success) return parsed.response;

  return postDiscard(parsed.data);
}
