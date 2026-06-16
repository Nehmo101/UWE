import { NextResponse } from "next/server";
import { createBrainStoreService, createPrismaClient } from "@uwe/database/server";
import {
  guardStudioMutation,
  idSchema,
  parseBody,
  parseParams,
  passthroughBodySchema,
  requireStudioApiAuth,
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
  const authError = requireStudioApiAuth(request);
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
        return NextResponse.json({ error: "Brain-Fakt nicht gefunden." }, { status: 404 });
      }
      const links = await Promise.all([
        brain.listLinksForSource(worldSlug, "brain_fact", entryId),
        brain.listLinksForTarget(worldSlug, "brain_fact", entryId),
      ]);
      return NextResponse.json({ fact, links: { outgoing: links[0], incoming: links[1] } });
    }

    const document = await brain.getDocumentByIdForWorld(worldSlug, entryId);
    if (!document) {
      return NextResponse.json({ error: "Brain-Dokument nicht gefunden." }, { status: 404 });
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
  const authError = guardStudioMutation(request, { rateLimit: "ai" });
  if (authError) return authError;

  const parsedParams = await parseParams(params, brainEntryParamsSchema);
  if (!parsedParams.success) return parsedParams.response;

  const parsed = await parseBody(request, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  const { worldSlug, entryId } = parsedParams.data;
  const body = parsed.data as Record<string, unknown> & { kind?: string };

  const db = createPrismaClient();
  const brain = createBrainStoreService();
  try {
    const existingDoc = await brain.getDocumentByIdForWorld(worldSlug, entryId);
    if (existingDoc) {
      const document = await brain.updateDocument(entryId, {
        title: body.title as string | undefined,
        content: body.content as string | undefined,
        documentType: body.documentType as never,
        visibility: body.visibility as never,
        source: body.source as never,
        status: body.status as never,
        campaignId: body.campaignId as string | null | undefined,
        pageId: body.pageId as string | null | undefined,
        gameSessionId: body.gameSessionId as string | null | undefined,
      });
      return NextResponse.json({ document });
    }

    const existingFact = await brain.getFactByIdForWorld(worldSlug, entryId);
    if (!existingFact) {
      return NextResponse.json({ error: "Brain-Eintrag nicht gefunden." }, { status: 404 });
    }

    const fact = await brain.updateFact(entryId, {
      title: body.title as string | undefined,
      content: body.content as string | undefined,
      factType: body.factType as never,
      visibility: body.visibility as never,
      source: body.source as never,
      status: body.status as never,
      campaignId: body.campaignId as string | null | undefined,
      pageId: body.pageId as string | null | undefined,
      gameSessionId: body.gameSessionId as string | null | undefined,
    });
    return NextResponse.json({ fact });
  } catch (error) {
    return safeHandlerError(error, "Brain-Eintrag konnte nicht aktualisiert werden.");
  } finally {
    await db.$disconnect();
  }
}
