import { postDiscard } from "../../../../../src/lib/ai-handlers";
import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { idSchema, optionalString, parseBody } from "@uwe/security";
import { z } from "zod";

const aiDiscardBodySchema = z.object({
  proposalId: idSchema,
  reason: optionalString,
});

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiDiscardBodySchema);
  if (!parsed.success) return parsed.response;

  return postDiscard(parsed.data);
}
