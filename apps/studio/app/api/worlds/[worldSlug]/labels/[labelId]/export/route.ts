import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createLabelService,
  getAppRepository,
  normalizeLabel,
  renderLabelExportAsync,
} from "@uwe/database/server";
import { logLabelExportActivity } from "@/app/label-actions";
import { renderLabelPngExportAsync } from "@/src/lib/label-png-export";
import { idSchema, parseParams, worldSlugParamSchema } from "@uwe/security";

const labelExportParamsSchema = worldSlugParamSchema.extend({
  labelId: idSchema,
});

interface Props {
  params: Promise<{ worldSlug: string; labelId: string }>;
}

export async function GET(request: Request, { params }: Props) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, labelExportParamsSchema);
  if (!parsedParams.success) return parsedParams.response;

  const { worldSlug, labelId } = parsedParams.data;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "html";
  const version = url.searchParams.get("version");

  const repo = getAppRepository();
  const labelService = createLabelService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return jsonError("World not found", 404);
  }

  const label = await labelService.getLabelById(labelId);
  if (!label || label.worldId !== world.id) {
    return jsonError("Label not found", 404);
  }

  const parsed = normalizeLabel(label);
  const playerVersion = version === "player";

  const content = playerVersion ? parsed.content : parsed.content;

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

  const exportOptions = {
    content,
    layoutSettings: parsed.layoutSettings,
    title: label.title,
    imageUrl: content.imageAssetId ? imageUrls[content.imageAssetId] : null,
    imageUrls,
    worldName: world.name,
  };

  const exported =
    format === "png"
      ? await renderLabelPngExportAsync(exportOptions)
      : await renderLabelExportAsync(
          format === "pdf" ? "pdf" : format === "print" ? "print" : "html",
          exportOptions,
        );

  const body =
    typeof exported.body === "string" ? exported.body : Buffer.from(exported.body);

  if (format === "pdf" || format === "print") {
    await labelService.setPrintStatus(labelId, format === "pdf" ? "exported" : "printed");
  }

  await logLabelExportActivity(worldSlug, labelId, label.title, format);

  return new NextResponse(body, {
    headers: {
      "Content-Type": exported.contentType,
      "Content-Disposition": `attachment; filename="${exported.filename}"`,
      ...(exported.fallback ? { "X-UWE-Export-Fallback": "1" } : {}),
      ...(exported.fallbackReason
        ? { "X-UWE-Export-Fallback-Reason": exported.fallbackReason }
        : {}),
    },
  });
}
