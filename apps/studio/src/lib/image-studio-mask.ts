/** Scale source image dimensions to fit a max edge while preserving aspect ratio. */
export function computeCanvasDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxDim = 1024,
): { width: number; height: number; scale: number } {
  const safeW = Math.max(1, naturalWidth);
  const safeH = Math.max(1, naturalHeight);
  const scale = Math.min(1, maxDim / Math.max(safeW, safeH));
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
    scale,
  };
}

/** Export white-on-black inpaint mask PNG base64 (no data: prefix). */
export function exportInpaintMaskBase64(
  maskCanvas: HTMLCanvasElement,
  sourceWidth: number,
  sourceHeight: number,
): string {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(1, sourceWidth);
  exportCanvas.height = Math.max(1, sourceHeight);
  const ctx = exportCanvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ctx.drawImage(maskCanvas, 0, 0, exportCanvas.width, exportCanvas.height);

  return exportCanvas.toDataURL("image/png").split(",")[1] ?? "";
}
