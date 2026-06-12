import sharp from "sharp";
import {
  renderLabelSvg,
  type LabelExportOptions,
  type LabelExportResult,
} from "@uwe/database/server";

export async function renderLabelPngExportAsync(
  options: LabelExportOptions,
): Promise<LabelExportResult> {
  const safeTitle = options.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "label";
  const svg = renderLabelSvg(options);

  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return {
      body: png,
      contentType: "image/png",
      filename: `${safeTitle}.png`,
    };
  } catch (error) {
    return {
      body: svg,
      contentType: "image/svg+xml; charset=utf-8",
      filename: `${safeTitle}.svg`,
      fallback: true,
      fallbackReason:
        error instanceof Error ? error.message : "PNG-Export nicht verfügbar (sharp)",
    };
  }
}
