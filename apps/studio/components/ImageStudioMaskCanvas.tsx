"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  computeCanvasDimensions,
  exportInpaintMaskBase64,
} from "../src/lib/image-studio-mask";

export interface ImageStudioMaskCanvasProps {
  sourcePreview: string | null;
  sourceBase64: string;
  onMaskChange: (maskBase64: string) => void;
  disabled?: boolean;
}

export function ImageStudioMaskCanvas({
  sourcePreview,
  sourceBase64,
  onMaskChange,
  disabled = false,
}: ImageStudioMaskCanvasProps) {
  const displayRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const [brushSize, setBrushSize] = useState(24);
  const [naturalSize, setNaturalSize] = useState({ width: 512, height: 512 });

  const redraw = useCallback(() => {
    const display = displayRef.current;
    const mask = maskRef.current;
    const image = sourceImageRef.current;
    if (!display || !mask) return;

    const dctx = display.getContext("2d");
    const mctx = mask.getContext("2d");
    if (!dctx || !mctx) return;

    dctx.clearRect(0, 0, display.width, display.height);
    if (image?.complete) {
      dctx.drawImage(image, 0, 0, display.width, display.height);
    }

    dctx.save();
    dctx.globalAlpha = 0.45;
    dctx.fillStyle = "#ef4444";
    dctx.fillRect(0, 0, display.width, display.height);
    dctx.globalCompositeOperation = "destination-in";
    dctx.drawImage(mask, 0, 0, display.width, display.height);
    dctx.restore();
  }, []);

  useEffect(() => {
    if (!sourcePreview) {
      sourceImageRef.current = null;
      onMaskChange("");
      return;
    }

    const image = new Image();
    image.onload = () => {
      sourceImageRef.current = image;
      const dims = computeCanvasDimensions(image.naturalWidth, image.naturalHeight);
      setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });

      for (const canvas of [displayRef.current, maskRef.current]) {
        if (!canvas) continue;
        canvas.width = dims.width;
        canvas.height = dims.height;
      }

      const mask = maskRef.current;
      const mctx = mask?.getContext("2d");
      if (mask && mctx) {
        mctx.clearRect(0, 0, mask.width, mask.height);
      }
      onMaskChange("");
      redraw();
    };
    image.src = sourcePreview;
  }, [sourcePreview, onMaskChange, redraw]);

  useEffect(() => {
    redraw();
  }, [redraw, sourceBase64]);

  function pointerPos(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = displayRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function paintMask(event: React.PointerEvent<HTMLCanvasElement>) {
    const mask = maskRef.current;
    const ctx = mask?.getContext("2d");
    if (!ctx || !mask || disabled) return;

    const { x, y } = pointerPos(event);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();

    onMaskChange(exportInpaintMaskBase64(mask, naturalSize.width, naturalSize.height));
    redraw();
  }

  function clearMask() {
    const mask = maskRef.current;
    const ctx = mask?.getContext("2d");
    if (!mask || !ctx) return;
    ctx.clearRect(0, 0, mask.width, mask.height);
    onMaskChange("");
    redraw();
  }

  if (!sourcePreview) {
    return (
      <p className="uwe-hint">
        Lade zuerst ein Quellbild hoch — die Maske wird darüber gezeichnet.
      </p>
    );
  }

  return (
    <div className="uwe-form" style={{ gap: "0.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <label>
          Pinsel
          <input
            type="range"
            min={8}
            max={64}
            value={brushSize}
            disabled={disabled}
            onChange={(event) => setBrushSize(Number(event.target.value))}
          />
        </label>
        <Button type="button" variant="secondary" disabled={disabled} onClick={clearMask}>
          Maske löschen
        </Button>
      </div>
      <p className="uwe-hint">Rot markierte Bereiche werden für Inpainting verwendet.</p>
      <canvas
        ref={displayRef}
        style={{
          width: "100%",
          maxWidth: "24rem",
          aspectRatio: `${naturalSize.width} / ${naturalSize.height}`,
          border: "1px solid var(--uwe-border)",
          touchAction: "none",
          cursor: disabled ? "not-allowed" : "crosshair",
        }}
        onPointerDown={(event) => {
          if (disabled) return;
          drawingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          paintMask(event);
        }}
        onPointerMove={(event) => {
          if (drawingRef.current) paintMask(event);
        }}
        onPointerUp={(event) => {
          drawingRef.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerLeave={() => {
          drawingRef.current = false;
        }}
      />
      <canvas ref={maskRef} aria-hidden="true" style={{ display: "none" }} />
    </div>
  );
}
