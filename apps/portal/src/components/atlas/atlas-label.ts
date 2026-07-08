/**
 * Label-Rendering für den Portal-AtlasViewer — gebogene (LabelAnchor mit
 * pathCoordinates) und gerade Labels inkl. der geteilten Typo-Presets
 * (`resolveLabelPreset`, Roadmap W3 #8). Ohne `style.labelPreset` bleibt der
 * historische Look unverändert; aus AtlasViewer.tsx extrahiert (Frozen-Budget).
 */

import type { AtlasStylePreset } from "@uwe/atlas/style-presets";
import { layoutCharactersOnPath, resolveLabelPreset } from "@uwe/atlas/label-layout";

type W2C = (nx: number, ny: number) => [number, number];

export interface LabelFeatureLike {
  labelText?: string | null;
  labelColor?: "black" | "red" | null;
  style?: Record<string, unknown>;
  geometry: {
    text?: string;
    pathCoordinates?: [number, number][];
    pathReversed?: boolean;
  };
}

/** Zeichnet ein LabelAnchor-Feature an (px, py); Hover zeichnet den Rahmen. */
export function drawViewerLabel(
  ctx: CanvasRenderingContext2D,
  feat: LabelFeatureLike,
  px: number,
  py: number,
  preset: AtlasStylePreset,
  zoom: number,
  w2c: W2C,
  isHovered: boolean,
): void {
  const lp = resolveLabelPreset(feat.style?.labelPreset);
  const rawLabel = feat.labelText ?? feat.geometry.text ?? "Label";
  const labelText = lp?.uppercase ? rawLabel.toUpperCase() : rawLabel;
  const inkColor = feat.labelColor === "red" ? preset.colors.inkAccent : preset.colors.ink;
  const pathCoords = feat.geometry.pathCoordinates;
  const weight = lp ? `${lp.bold ? "bold " : ""}${lp.italic ? "italic " : ""}` : null;

  if (pathCoords && pathCoords.length >= 2) {
    ctx.font = `${weight ?? "bold "}${Math.round((lp ? lp.sizePx : 13) * zoom)}px ${preset.typography.labelRegion}`;
    ctx.fillStyle = inkColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Constant spacing in world units — font and spacing both scale with
    // zoom, keeping curved labels compact at every zoom level.
    const placements = layoutCharactersOnPath(
      labelText,
      pathCoords,
      0.0085,
      feat.geometry.pathReversed === true,
    );
    for (const placement of placements) {
      const [cx, cy] = w2c(placement.x, placement.y);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(placement.rotation);
      if (lp?.halo) {
        ctx.strokeStyle = preset.colors.parchment;
        ctx.lineWidth = 3 * zoom;
        ctx.strokeText(placement.char, 0, 0);
      }
      ctx.fillText(placement.char, 0, 0);
      ctx.restore();
    }
    return;
  }

  ctx.font = `${weight ?? ""}${Math.round((lp ? lp.sizePx : 14) * zoom)}px ${preset.typography.labelCity}`;
  ctx.textAlign = "center";
  if (lp?.letterSpacingPx) ctx.letterSpacing = `${lp.letterSpacingPx * zoom}px`;
  if (lp?.halo) {
    ctx.strokeStyle = preset.colors.parchment;
    ctx.lineWidth = 3 * zoom;
    ctx.strokeText(labelText, px, py);
  }
  ctx.fillStyle = inkColor;
  ctx.fillText(labelText, px, py);
  if (lp?.letterSpacingPx) ctx.letterSpacing = "0px";
  if (isHovered) {
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5;
    const tw = ctx.measureText(labelText).width;
    ctx.strokeRect(px - tw / 2 - 2, py - 14 * zoom, tw + 4, 16 * zoom);
  }
}
