import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createDevIdeaService,
  parseDevIdeaTranscript,
  parseIdeaAttachments,
  prisma,
} from "@uwe/database/server";
import { idSchema, parseBody, parseParams } from "@uwe/security";
import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { executeAiPrompt } from "@/src/lib/ai-prompt-handlers";
import { composeIdeaPromptGeneration } from "@/src/lib/idea-prompt";
import { ownerForbiddenResponse, resolveOwnerApiUser } from "@/src/lib/owner-api-auth";
import { jsonError } from "@/src/lib/api-response";

const ideaIdParamSchema = z.object({ id: idSchema });

const ideaPromptBodySchema = z.object({
  providerMode: z.enum(["auto", "local_rtx", "cloud"]).default("auto"),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const owner = await resolveOwnerApiUser();
  if (!owner) return ownerForbiddenResponse();

  const parsedParams = await parseParams(context.params, ideaIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, ideaPromptBodySchema);
  if (!parsed.success) return parsed.response;

  const ideas = createDevIdeaService(prisma);
  const idea = await ideas.getIdea(parsedParams.data.id);
  if (!idea) {
    return jsonError("Idee nicht gefunden.", 404);
  }

  const transcript = parseDevIdeaTranscript(idea.chatTranscript);
  if (transcript.length === 0) {
    return NextResponse.json(
      { error: "Bitte zuerst die Idee im KI-Chat besprechen, bevor ein Prompt erstellt wird." },
      { status: 400 },
    );
  }

  const generationPrompt = composeIdeaPromptGeneration(idea.title, idea.body, transcript, {
    attachments: parseIdeaAttachments(idea.attachments),
    baseUrl: new URL(request.url).origin,
  });

  try {
    const result = await executeAiPrompt(
      {
        prompt: generationPrompt,
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

    const generatedPrompt = result.text.trim();
    const updated = await ideas.setGeneratedPrompt(idea.id, generatedPrompt);

    return NextResponse.json({
      generatedPrompt: updated.generatedPrompt,
      provider: result.provider,
      model: result.model,
      routedVia: result.routedVia,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prompt-Erstellung fehlgeschlagen.";
    return jsonError(message, 502);
  }
}
