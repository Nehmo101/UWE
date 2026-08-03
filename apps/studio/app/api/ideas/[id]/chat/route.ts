import { NextResponse } from "next/server";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import { z } from "zod";
import {
  createDevIdeaService,
  parseDevIdeaTranscript,
  parseIdeaAttachments,
  prisma,
} from "@uwe/database/server";
import type { DevIdeaChatMessage } from "@uwe/database/server";
import { idSchema, nonEmptyString, parseBody, parseParams } from "@uwe/security";
import { executeAiPrompt } from "@/src/lib/ai-prompt-handlers";
import { composeIdeaChatPrompt } from "@/src/lib/idea-prompt";
import { ownerForbiddenResponse, resolveOwnerApiUser } from "@/src/lib/owner-api-auth";
import { jsonError } from "@/src/lib/api-response";

const ideaIdParamSchema = z.object({ id: idSchema });

const ideaChatBodySchema = z.object({
  message: nonEmptyString.max(8_000),
  providerMode: z.enum(["auto", "local_engine", "cloud"]).default("auto"),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const owner = await resolveOwnerApiUser();
  if (!owner) return ownerForbiddenResponse();

  const parsedParams = await parseParams(context.params, ideaIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, ideaChatBodySchema);
  if (!parsed.success) return parsed.response;

  const ideas = createDevIdeaService(prisma);
  const idea = await ideas.getIdea(parsedParams.data.id);
  if (!idea) {
    return jsonError("Idee nicht gefunden.", 404);
  }

  const transcript = parseDevIdeaTranscript(idea.chatTranscript);
  const userMessage: DevIdeaChatMessage = {
    role: "user",
    content: parsed.data.message.trim(),
    createdAt: new Date().toISOString(),
  };

  const composedPrompt = composeIdeaChatPrompt(
    idea.title,
    idea.body,
    transcript,
    userMessage.content,
    {
      attachments: parseIdeaAttachments(idea.attachments),
      baseUrl: new URL(request.url).origin,
    },
  );

  try {
    const result = await executeAiPrompt(
      {
        prompt: composedPrompt,
        providerMode: parsed.data.providerMode,
        contextMode: "general_chat",
        useMock: process.env.AI_USE_MOCK === "true",
      },
      owner,
    );

    if (result.kind === "deferred") {
      return NextResponse.json(
        { deferred: true, jobId: result.jobId, message: result.message },
        { status: 202 },
      );
    }

    const assistantMessage: DevIdeaChatMessage = {
      role: "assistant",
      content: result.text,
      createdAt: new Date().toISOString(),
      via: result.routedVia,
    };

    const { transcript: updatedTranscript } = await ideas.appendChatMessages(idea.id, [
      userMessage,
      assistantMessage,
    ]);

    return NextResponse.json({
      transcript: updatedTranscript,
      reply: assistantMessage,
      provider: result.provider,
      model: result.model,
      routedVia: result.routedVia,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "KI-Anfrage fehlgeschlagen.";
    return jsonError(message, 502);
  }
}
