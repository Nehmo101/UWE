import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createDevIdeaService,
  parseIdeaAttachments,
  prisma,
  type DevIdeaAttachment,
} from "@uwe/database/server";
import { guardStudioMutation, idSchema, parseBody, parseParams } from "@uwe/security";
import { ownerForbiddenResponse, resolveOwnerApiUser } from "@/src/lib/owner-api-auth";

const ideaIdParamSchema = z.object({ id: idSchema });

const attachmentSchema = z.object({
  assetId: z.string().min(1).max(64),
  title: z.string().max(255).optional(),
  mimeType: z.string().max(128).optional(),
});

const attachmentsBodySchema = z.object({
  attachments: z.array(attachmentSchema).max(10),
});

/** Replace an idea's image attachments with the provided list. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = guardStudioMutation(request);
  if (authError) return authError;

  const owner = await resolveOwnerApiUser();
  if (!owner) return ownerForbiddenResponse();

  const parsedParams = await parseParams(context.params, ideaIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, attachmentsBodySchema);
  if (!parsed.success) return parsed.response;

  const ideas = createDevIdeaService(prisma);
  const idea = await ideas.getIdea(parsedParams.data.id);
  if (!idea) {
    return NextResponse.json({ error: "Idee nicht gefunden." }, { status: 404 });
  }

  const attachments: DevIdeaAttachment[] = parsed.data.attachments.map((entry) => ({
    assetId: entry.assetId,
    ...(entry.title ? { title: entry.title } : {}),
    ...(entry.mimeType ? { mimeType: entry.mimeType } : {}),
  }));

  const updated = await ideas.setAttachments(idea.id, attachments);
  return NextResponse.json({ attachments: parseIdeaAttachments(updated.attachments) });
}
