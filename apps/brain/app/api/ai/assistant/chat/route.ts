import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { runAssistantTurn } from "@uwe/brain-assistant";
import { getCurrentUser } from "@/src/lib/auth";
import {
  assistantError,
  assistantRunnerDeps,
  assistantService,
  guardAssistantApi,
  resolveUploadsRootForAssistant,
} from "@/src/lib/assistant-api";

/**
 * One assistant turn. Blocking by design — the connector queue is
 * request/response and UWE has no streaming transport anywhere.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ChatBody {
  conversationId?: unknown;
  question?: unknown;
  attachmentIds?: unknown;
}

export async function POST(request: Request) {
  const guardError = await guardAssistantApi(request, "ai");
  if (guardError) return guardError;

  const user = await getCurrentUser();
  if (!user) {
    return assistantError("Authentifizierung erforderlich.", 401);
  }

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return assistantError("Ungültiger Anfrage-Body.");
  }

  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  if (!conversationId) {
    return assistantError("Keine Unterhaltung angegeben.");
  }

  const question = typeof body.question === "string" ? body.question : "";
  const attachmentIds = Array.isArray(body.attachmentIds)
    ? body.attachmentIds.filter((id): id is string => typeof id === "string").slice(0, 10)
    : [];

  const result = await runAssistantTurn(assistantRunnerDeps(prisma), {
    conversationId,
    question,
    attachmentIds,
    user: { userId: user.id, role: user.role },
    uploadsRoot: await resolveUploadsRootForAssistant(),
  });

  if (result.kind === "unavailable") {
    return NextResponse.json({ error: result.message, unavailable: true }, { status: 503 });
  }

  // Return the whole thread: the turn persisted both the question (with its
  // attachments) and the answer, and the client would otherwise have to guess
  // their ids to stay in sync.
  const conversation = await assistantService().getConversation(conversationId);
  return NextResponse.json({
    message: result.message,
    messages: conversation?.messages ?? [result.message],
  });
}
