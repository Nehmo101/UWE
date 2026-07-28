import { NextResponse } from "next/server";
import { createMailAccountService } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { idSchema, parseParams } from "@uwe/security";
import { z } from "zod";
import { requireBrainMailApi, requireBrainMailMutation, mailApiError } from "@/src/lib/mail-api";

const draftIdParamSchema = z.object({ id: idSchema });

const updateDraftBodySchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  bodyText: z.string().max(200_000).nullable().optional(),
  bodyHtml: z.string().max(500_000).nullable().optional(),
  accountId: z.string().nullable().optional(),
  toAddresses: z.array(z.string().email()).nullable().optional(),
  status: z.enum(["draft", "pending_review", "sent"]).optional(),
});

function serializeDraft(draft: NonNullable<Awaited<ReturnType<ReturnType<typeof createMailAccountService>["getDraft"]>>>) {
  const toRaw = draft.toAddresses;
  const toAddresses = Array.isArray(toRaw) ? (toRaw as string[]) : [];
  return {
    id: draft.id,
    accountId: draft.accountId,
    worldId: draft.worldId,
    replyToMessageId: draft.replyToMessageId,
    subject: draft.subject,
    bodyText: draft.bodyText,
    bodyHtml: draft.bodyHtml,
    toAddresses,
    status: draft.status,
    updatedAt: draft.updatedAt.toISOString(),
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBrainMailApi();
  if (auth.error) return auth.error;

  const parsedParams = await parseParams(context.params, draftIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  const service = createMailAccountService(brainPrisma);
  const draft = await service.getDraft(parsedParams.data.id);
  if (!draft) {
    return mailApiError("Entwurf nicht gefunden.", 404);
  }

  return NextResponse.json({ draft: serializeDraft(draft) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBrainMailMutation(request);
  if (auth.error) return auth.error;

  const parsedParams = await parseParams(context.params, draftIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  let body: z.infer<typeof updateDraftBodySchema>;
  try {
    body = updateDraftBodySchema.parse(await request.json());
  } catch {
    return mailApiError("Ungültiger JSON-Body.", 400);
  }

  const service = createMailAccountService(brainPrisma);
  const existing = await service.getDraft(parsedParams.data.id);
  if (!existing) {
    return mailApiError("Entwurf nicht gefunden.", 404);
  }

  const draft = await service.updateDraft(parsedParams.data.id, body);
  return NextResponse.json({ draft: serializeDraft(draft) });
}
