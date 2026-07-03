import { NextResponse } from "next/server";
import { guardStudioMutation, lifeBrainChatBodySchema, parseBody } from "@uwe/security";
import { aiPromptErrorResponse } from "@/src/lib/ai-prompt-handlers";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { executeLifeBrainChat } from "@/src/lib/life-brain-chat";
import { jsonError } from "@/src/lib/api-response";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "ai" });
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
      return NextResponse.json({ error: result.message, unavailable: true }, { status: 503 });
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
