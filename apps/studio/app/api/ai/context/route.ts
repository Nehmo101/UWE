import { postContext } from "../../../../src/lib/ai-handlers";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { aiContextBodySchema, parseBody } from "@uwe/security";

export async function POST(request: Request) {
  const authError = await guardStudioApiRequest(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, aiContextBodySchema);
  if (!parsed.success) return parsed.response;

  return postContext(parsed.data);
}
