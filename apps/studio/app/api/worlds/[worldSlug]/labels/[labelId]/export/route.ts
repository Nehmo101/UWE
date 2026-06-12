import { NextResponse } from "next/server";
import {
  assertPlayerSafeExport,
  createLabelService,
  getAppRepository,
  normalizeLabel,
  renderLabelExportAsync,
  stripDmOnlyForPlayer,
} from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string; labelId: string }>;
}

export async function GET(request: Request, { params }: Props) {
  const { worldSlug, labelId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "html";
  const includeDmOnly = url.searchParams.get("includeDmOnly");
  const version = url.searchParams.get("version");

  const repo = getAppRepository();
  const labelService = createLabelService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return NextResponse.json({ error: "World not found" }, { status: 404 });
  }

  const label = await labelService.getLabelById(labelId);
  if (!label || label.worldId !== world.id) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  const parsed = normalizeLabel(label);
  const allowDm = includeDmOnly === "1" || version === "dm";
  const playerVersion = version === "player";

  const content = playerVersion ? stripDmOnlyForPlayer(parsed.content) : parsed.content;

  const safety = assertPlayerSafeExport(content, allowDm || !playerVersion);
  if (!safety.allowed && playerVersion) {
    return NextResponse.json({ error: safety.reason }, { status: 403 });
  }

  const exportFormat =
    format === "pdf" ? "pdf" : format === "print" ? "print" : "html";

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

  const exported = await renderLabelExportAsync(exportFormat, {
    content,
    layoutSettings: parsed.layoutSettings,
    title: label.title,
    imageUrl: content.imageAssetId ? imageUrls[content.imageAssetId] : null,
    imageUrls,
    worldName: world.name,
    includeDmOnly: allowDm,
  });

  const body =
    typeof exported.body === "string" ? exported.body : Buffer.from(exported.body);

  if (format === "pdf" || format === "print") {
    await labelService.setPrintStatus(labelId, format === "pdf" ? "exported" : "printed");
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": exported.contentType,
      "Content-Disposition": `attachment; filename="${exported.filename}"`,
      ...(exported.fallback ? { "X-UWE-Export-Fallback": "1" } : {}),
    },
  });
}
