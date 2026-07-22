import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  buildDocumentPrintHtml,
  createLifeAdminService,
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  prisma,
  type DocumentTemplateCategory,
} from "@uwe/database/server";

/**
 * Print-freundliche Ansicht eines generierten Dokuments
 * (Life-Brain-Dokument, Konvention wie /api/worlds/.../characters/print).
 */
export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId")?.trim();
  if (!documentId) {
    return jsonError("documentId fehlt.", 400);
  }

  const service = createLifeAdminService(brainPrisma, prisma);
  const document = await service.getPersonalBrainDocument(documentId);
  if (!document) {
    return jsonError("Dokument nicht gefunden.", 404);
  }

  const metadata =
    document.metadata && typeof document.metadata === "object" && !Array.isArray(document.metadata)
      ? (document.metadata as Record<string, unknown>)
      : {};
  const templateCategory =
    typeof metadata.templateCategory === "string" &&
    metadata.templateCategory in DOCUMENT_TEMPLATE_CATEGORY_LABELS
      ? (metadata.templateCategory as DocumentTemplateCategory)
      : null;

  const html = buildDocumentPrintHtml({
    title: document.title,
    content: document.content,
    templateName:
      typeof metadata.generatedFromTemplateName === "string"
        ? metadata.generatedFromTemplateName
        : null,
    categoryLabel: templateCategory
      ? DOCUMENT_TEMPLATE_CATEGORY_LABELS[templateCategory]
      : null,
    generatedAt:
      typeof metadata.generatedAt === "string"
        ? metadata.generatedAt
        : document.createdAt.toISOString(),
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
