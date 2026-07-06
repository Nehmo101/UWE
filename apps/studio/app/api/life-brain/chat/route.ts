import { NextResponse } from "next/server";
import { lifeBrainChatBodySchema, parseBody } from "@uwe/security";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import { aiPromptErrorResponse } from "@/src/lib/ai-prompt-handlers";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { executeLifeBrainChat } from "@/src/lib/life-brain-chat";
import { jsonError } from "@/src/lib/api-response";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsed = await parseBody(request, lifeBrainChatBodySchema);
  if (!parsed.success) return parsed.response;

  const user = await getCurrentAuthUser();
  if (!user) {
    return jsonError("Authentifizierung erforderlich.", 401);
  }

  try {
    const result = await executeLifeBrainChat(parsed.data, {
      userId: user.id,
      role: user.role,
    });

    if (result.kind === "unavailable") {
      return jsonError(result.message, 503, { unavailable: true });
    }

    return NextResponse.json({
      text: result.text,
      provider: result.provider,
      model: result.model,
      routedVia: result.routedVia,
    });
  } catch (error) {
    return aiPromptErrorResponse(error);
  }
}
