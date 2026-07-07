"use client";

/**
 * RtxAssetRecipePreview — small deterministic canvas preview for a validated
 * RTX Gouache JSON recipe. Pure data-driven rendering via
 * `drawRtxGouacheRecipePreview` (@uwe/atlas/rtx-asset-preview) — no eval, no
 * generated code. Callers must only pass recipes that went through
 * `validateRtxAtlasAssetProposal` server-side.
 */

import { useEffect, useRef } from "react";
import type { RtxGouacheJsonRecipe } from "@uwe/atlas/rtx-asset-proposal";
import {
  drawRtxGouacheRecipePreview,
  RTX_RECIPE_NORMALIZED_EXTENT,
} from "@uwe/atlas/rtx-asset-preview";

export interface RtxAssetRecipePreviewProps {
  recipe: RtxGouacheJsonRecipe;
  /** Canvas edge length in px. Default 160. */
  size?: number;
}

const PARCHMENT = "#f2e8c9";

export function RtxAssetRecipePreview({ recipe, size = 160 }: RtxAssetRecipePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = PARCHMENT;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Anchor the recipe origin at the canvas centre so the full normalized
    // -4..4 range is visible; one unit = size / (2 * extent) px.
    drawRtxGouacheRecipePreview(ctx, recipe, {
      x: canvas.width / 2,
      y: canvas.height / 2,
      unitScale: canvas.width / (RTX_RECIPE_NORMALIZED_EXTENT * 2),
    });
  }, [recipe, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      role="img"
      aria-label="Rezept-Vorschau"
      style={{
        width: size,
        height: size,
        border: "1px solid var(--uwe-border)",
        borderRadius: 4,
        background: PARCHMENT,
      }}
    />
  );
}
