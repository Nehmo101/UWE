import { NextResponse } from "next/server";
import {
  assertPlayerSafeExport,
  createPrintListService,
  getAppRepository,
  normalizeLabel,
  renderMultiLabelHtml,
  renderMultiLabelPdfAsync,
  stripDmOnlyForPlayer,
} from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string; printListId: string }>;
}

export async function GET(request: Request, { params }: Props) {
  const { worldSlug, printListId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "html";
  const includeDmOnly = url.searchParams.get("includeDmOnly") === "1";

  const repo = getAppRepository();
  const printListService = createPrintListService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  const list = await printListService.getById(printListId);
  if (!list || list.worldId !== world.id) {
    return NextResponse.json({ error: "Print list not found" }, { status: 404 });
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

  if (format === "pdf") {
    try {
      const pdf = await renderMultiLabelPdfAsync(exportOptions);
      await printListService.markStatus(printListId, "exported");
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        },
      });
    } catch (error) {
      const html = renderMultiLabelHtml(exportOptions, true);
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

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.${format === "print" ? "print.html" : "html"}"`,
    },
  });
}
