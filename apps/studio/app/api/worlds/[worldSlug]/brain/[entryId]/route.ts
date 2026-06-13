import { NextResponse } from "next/server";
import { createBrainStoreService, createPrismaClient } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

interface RouteParams {
  params: Promise<{ worldSlug: string; entryId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { worldSlug, entryId } = await params;
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
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { worldSlug, entryId } = await params;
  const body = (await request.json()) as Record<string, unknown> & { kind?: string };

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
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    await db.$disconnect();
  }
}
