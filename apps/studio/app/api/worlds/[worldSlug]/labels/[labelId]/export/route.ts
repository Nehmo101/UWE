import { NextResponse } from "next/server";
import {
  assertPlayerSafeExport,
  createLabelService,
  getAppRepository,
  normalizeLabel,
  renderLabelExport,
} from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string; labelId: string }>;
  searchParams: Promise<{ format?: string; includeDmOnly?: string }>;
}

export async function GET(request: Request, { params, searchParams }: Props) {
  const { worldSlug, labelId } = await params;
  const { format = "html", includeDmOnly } = await searchParams;

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
  const allowDm = includeDmOnly === "1";

  const safety = assertPlayerSafeExport(parsed.content, allowDm);
  if (!safety.allowed) {
    return NextResponse.json({ error: safety.reason }, { status: 403 });
  }

  const exportFormat =
    format === "pdf" ? "pdf" : format === "print" ? "print" : "html";

  const imageUrl = parsed.content.imageAssetId
    ? new URL(`/api/assets/${parsed.content.imageAssetId}/file`, request.url).toString()
    : null;

  const exported = renderLabelExport(exportFormat, {
    content: parsed.content,
    layoutSettings: parsed.layoutSettings,
    title: label.title,
    imageUrl,
    worldName: world.name,
  });

  const body =
    typeof exported.body === "string" ? exported.body : Buffer.from(exported.body);

  return new NextResponse(body, {
    headers: {
      "Content-Type": exported.contentType,
      "Content-Disposition": `attachment; filename="${exported.filename}"`,
    },
  });
}
