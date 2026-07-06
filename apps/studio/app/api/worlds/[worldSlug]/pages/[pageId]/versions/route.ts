import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createPageVersionService, prisma } from "@uwe/database/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ worldSlug: string; pageId: string }> },
) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { pageId } = await context.params;
  const service = createPageVersionService(prisma);
  const versions = await service.list(pageId);
  return NextResponse.json({
    versions: versions.map((version) => ({
      ...version,
      createdAt: version.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ worldSlug: string; pageId: string }> },
) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { pageId } = await context.params;
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { contentBlocks: true },
  });
  if (!page) {
    return jsonError("Seite nicht gefunden.", 404);
  }

  const versionService = createPageVersionService(prisma);
  const created = await versionService.createSnapshot(pageId, {
    title: page.title,
    summary: page.summary,
    blocks: page.contentBlocks,
  });

  return NextResponse.json({
    version: {
      id: created.id,
      version: created.version,
      createdAt: created.createdAt.toISOString(),
    },
  });
}
