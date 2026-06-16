import { postContext } from "../../../../src/lib/ai-handlers";
import {
  aiContextBodySchema,
  guardStudioMutation,
  parseBody,
} from "@uwe/security";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiContextBodySchema);
  if (!parsed.success) return parsed.response;

  return postContext(parsed.data);
}
