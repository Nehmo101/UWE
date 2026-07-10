import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  assertPlayerSafeExport,
  createPrintListService,
  getAppRepository,
  normalizeLabel,
  renderMultiLabelHtml,
  renderMultiLabelPdfAsync,
  stripDmOnlyForPlayer,
} from "@uwe/database/server";
import { logPrintListExportActivity } from "@/app/print-list-actions";
import { renderLabelPngExportAsync } from "@/src/lib/label-png-export";
import { idSchema, parseParams, worldSlugParamSchema } from "@uwe/security";

const printListExportParamsSchema = worldSlugParamSchema.extend({
  printListId: idSchema,
});

interface Props {
  params: Promise<{ worldSlug: string; printListId: string }>;
}

export async function GET(request: Request, { params }: Props) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, printListExportParamsSchema);
  if (!parsedParams.success) return parsedParams.response;

  const { worldSlug, printListId } = parsedParams.data;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "html";
  const includeDmOnly = url.searchParams.get("includeDmOnly") === "1";

  const repo = getAppRepository();
  const printListService = createPrintListService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return jsonError("World not found", 404);
  }

  const list = await printListService.getById(printListId);
  if (!list || list.worldId !== world.id) {
    return jsonError("Print list not found", 404);
  }

  const expanded = printListService.expandItemsForExport(list);
  const exportOptions = [];

  for (const label of expanded) {
    const parsed = normalizeLabel(label);
    const content = includeDmOnly ? parsed.content : stripDmOnlyForPlayer(parsed.content);

    if (!includeDmOnly) {
      const safety = assertPlayerSafeExport(content, false);
      if (!safety.allowed) {
        return NextResponse.json(
          {
            error: `Label „${label.title}" enthält DM-only Inhalte.`,
            labelId: label.id,
          },
          { status: 403 },
        );
      }
    }

    const imageUrls: Record<string, string> = {};
    if (content.imageAssetId) {
      imageUrls[content.imageAssetId] = new URL(
        `/api/assets/${content.imageAssetId}/file`,
        request.url,
      ).toString();
    }
    for (const el of content.elements ?? []) {
      if (el.imageAssetId) {
        imageUrls[el.imageAssetId] = new URL(
          `/api/assets/${el.imageAssetId}/file`,
          request.url,
        ).toString();
      }
    }

    exportOptions.push({
      content,
      layoutSettings: parsed.layoutSettings,
      title: label.title,
      imageUrl: content.imageAssetId ? imageUrls[content.imageAssetId] : null,
      imageUrls,
      worldName: world.name,
      includeDmOnly,
    });
  }

  const safeName = list.name.replace(/[^\w\-]+/g, "_").slice(0, 60) || "druckliste";

  if (format === "png") {
    const first = exportOptions[0];
    if (!first) {
      return jsonError("Druckliste ist leer", 400);
    }
    const exported = await renderLabelPngExportAsync(first);
    const body =
      typeof exported.body === "string" ? exported.body : Buffer.from(exported.body);
    await logPrintListExportActivity(worldSlug, printListId, list.name, "png");
    return new NextResponse(body, {
      headers: {
        "Content-Type": exported.contentType,
        "Content-Disposition": `attachment; filename="${safeName}_01.${exported.filename.split(".").pop()}"`,
        ...(exported.fallback ? { "X-UWE-Export-Fallback": "1" } : {}),
        "X-UWE-Export-Note": "PNG enthält das erste Label — für alle Labels PDF/HTML nutzen.",
      },
    });
  }

  if (format === "pdf") {
    try {
      const pdf = await renderMultiLabelPdfAsync(exportOptions);
      await printListService.markStatus(printListId, "exported");
      await logPrintListExportActivity(worldSlug, printListId, list.name, "pdf");
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        },
      });
    } catch (error) {
      const html = renderMultiLabelHtml(exportOptions, true);
      await logPrintListExportActivity(worldSlug, printListId, list.name, "pdf-fallback");
      return new NextResponse(html, {
        status: 422,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}.print.html"`,
          "X-UWE-Export-Fallback": "1",
          "X-UWE-Export-Error": error instanceof Error ? error.message : "PDF failed",
        },
      });
    }
  }

  const html = renderMultiLabelHtml(exportOptions, format === "print");
  if (format === "print") {
    await printListService.markStatus(printListId, "printed");
  }

  await logPrintListExportActivity(worldSlug, printListId, list.name, format);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.${format === "print" ? "print.html" : "html"}"`,
    },
  });
}
