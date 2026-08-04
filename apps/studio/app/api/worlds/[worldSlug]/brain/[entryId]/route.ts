import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createBrainStoreService, createPrismaClient } from "@uwe/database/server";
import {
  brainEntryUpdateBodySchema,
  idSchema,
  parseBody,
  parseParams,
  safeHandlerError,
  worldSlugParamSchema,
} from "@uwe/security";

const brainEntryParamsSchema = worldSlugParamSchema.extend({
  entryId: idSchema,
});

interface RouteParams {
  params: Promise<{ worldSlug: string; entryId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, brainEntryParamsSchema);
  if (!parsedParams.success) return parsedParams.response;

  const { worldSlug, entryId } = parsedParams.data;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "document";

  const db = createPrismaClient();
  const brain = createBrainStoreService();
  try {
    if (kind === "fact") {
      const fact = await brain.getFactByIdForWorld(worldSlug, entryId);
      if (!fact) {
        return jsonError("Brain-Fakt nicht gefunden.", 404);
      }
      const links = await Promise.all([
        brain.listLinksForSource(worldSlug, "brain_fact", entryId),
        brain.listLinksForTarget(worldSlug, "brain_fact", entryId),
      ]);
      return NextResponse.json({ fact, links: { outgoing: links[0], incoming: links[1] } });
    }

    const document = await brain.getDocumentByIdForWorld(worldSlug, entryId);
    if (!document) {
      return jsonError("Brain-Dokument nicht gefunden.", 404);
    }
    const links = await Promise.all([
      brain.listLinksForSource(worldSlug, "brain_document", entryId),
      brain.listLinksForTarget(worldSlug, "brain_document", entryId),
    ]);
    return NextResponse.json({ document, links: { outgoing: links[0], incoming: links[1] } });
  } finally {
    await db.$disconnect();
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const authError = await guardStudioApiRequest(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsedParams = await parseParams(params, brainEntryParamsSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, brainEntryUpdateBodySchema);
  if (!parsed.success) return parsed.response;

  const { worldSlug, entryId } = parsedParams.data;
  const body = parsed.data;

  const db = createPrismaClient();
  const brain = createBrainStoreService();
  try {
    const existingDoc = await brain.getDocumentByIdForWorld(worldSlug, entryId);
    if (existingDoc) {
      const document = await brain.updateDocument(entryId, {
        title: body.title,
        content: body.content,
        documentType: body.documentType,
        source: body.source,
        status: body.status,
        campaignId: body.campaignId,
        pageId: body.pageId,
        gameSessionId: body.gameSessionId,
      });
      return NextResponse.json({ document });
    }

    const existingFact = await brain.getFactByIdForWorld(worldSlug, entryId);
    if (!existingFact) {
      return jsonError("Brain-Eintrag nicht gefunden.", 404);
    }

    const fact = await brain.updateFact(entryId, {
      title: body.title,
      content: body.content,
      factType: body.factType,
      source: body.source,
      status: body.status,
      campaignId: body.campaignId,
      pageId: body.pageId,
      gameSessionId: body.gameSessionId,
    });
    return NextResponse.json({ fact });
  } catch (error) {
    return safeHandlerError(error, "Brain-Eintrag konnte nicht aktualisiert werden.");
  } finally {
    await db.$disconnect();
  }
}
