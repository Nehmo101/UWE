"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  drawGouacheAsset,
  gouacheKeyForGlyph,
  hashStringToSeed,
  isGouacheAsset,
} from "@uwe/atlas";
import type { Atlas3D } from "@uwe/atlas-3d";
import { TOLKIEN_INK } from "@uwe/atlas/style-presets";

import { AtlasViewer, type AtlasViewerProps, type ViewerObject } from "./AtlasViewer";

function spriteKey(object: ViewerObject, paletteItems: AtlasViewerProps["paletteItems"]): string | null {
  const gouache = object.style?.gouache;
  if (gouache && isGouacheAsset(gouache)) return gouache;
  const glyph = paletteItems?.[object.paletteItemId]?.builtinGlyphKey;
  return (glyph ? gouacheKeyForGlyph(glyph) : null) ?? null;
}

async function nextPaint(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function Atlas3DViewer(props: AtlasViewerProps) {
  const router = useRouter();
  const preset = props.preset ?? TOLKIEN_INK;
  const { features, objects, tileLayer, paletteItems, pageLinkMap, worldSlug, nodeTitle } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bakeHostRef = useRef<HTMLDivElement | null>(null);
  const atlasRef = useRef<Atlas3D | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let atlas: Atlas3D | null = null;

    void import("@uwe/atlas-3d")
      .then(async ({ createAtlas3D }) => {
        if (cancelled) return;
        atlas = createAtlas3D(canvas, {
          getGrid: () => tileLayer ?? { cols: 64, rows: 40 },
          getObjects: () => objects,
          getLightDirection: () => tileLayer?.lightDir,
          async bakeGround(size) {
            await nextPaint();
            const source = bakeHostRef.current?.querySelector("canvas");
            if (!source) throw new Error("Atlas 2D ground canvas is unavailable");
            const target = document.createElement("canvas");
            target.width = size;
            target.height = Math.round(size / 1.6);
            const context = target.getContext("2d");
            if (!context) throw new Error("Canvas 2D is unavailable");
            context.drawImage(source, 0, 0, target.width, target.height);
            return target;
          },
          drawObjectSprite(context, rawObject, x, y, size) {
            const object = rawObject as ViewerObject;
            const gouache = spriteKey(object, paletteItems);
            if (gouache) {
              drawGouacheAsset(context as CanvasRenderingContext2D, gouache, {
                x,
                y,
                size,
                scale: object.scale,
                rotation: (object.rotation * Math.PI) / 180,
                lineWidth: object.style?.lineWidth ?? 1.4,
                blur: object.style?.blur ?? 0,
                seed: hashStringToSeed(object._key),
                tint: object.style?.tint ?? undefined,
              });
              return;
            }
            context.fillStyle = preset.colors.ink;
            context.beginPath();
            context.arc(x, y - size * 0.2, size * 0.16, 0, Math.PI * 2);
            context.fill();
          },
        }, { leftPan: true, groundBakeSize: 2048 });
        atlasRef.current = atlas;
        atlas.syncObjects();
        atlas.invalidateGround(true);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        console.error("Portal Atlas 3D failed", error);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      atlasRef.current = null;
      atlas?.destroy();
    };
  }, [features, objects, tileLayer, paletteItems, preset]);

  function handleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const atlas = atlasRef.current;
    if (!canvas || !atlas) return;
    const rect = canvas.getBoundingClientRect();
    const point = atlas.screenToWorldN(event.clientX - rect.left, event.clientY - rect.top);
    if (!point) return;
    const [nx, ny] = point;
    const object = [...objects].reverse().find((item) => Math.hypot(item.x - nx, item.y - ny) < 0.025);
    const linked = object ?? [...features].reverse().find((feature) => {
      const geometry = feature.geometry;
      if (geometry.type !== "Point" && geometry.type !== "LabelAnchor") return false;
      const coordinates = geometry.coordinates as [number, number] | undefined;
      return Boolean(coordinates && Math.hypot(coordinates[0] - nx, coordinates[1] - ny) < 0.025);
    });
    if (linked && "childNodeId" in linked && linked.childNodeId) {
      router.push(`/auth/worlds/${worldSlug}/atlas/${linked.childNodeId}`);
    } else if (linked?.linkedPageId && pageLinkMap?.[linked.linkedPageId]) {
      router.push(`/auth/worlds/${worldSlug}/${pageLinkMap[linked.linkedPageId]}`);
    }
  }

  return (
    <div style={{ position: "relative", minHeight: 480, overflow: "hidden", border: `2px solid ${preset.colors.ink}`, borderRadius: 4, background: preset.colors.parchment }}>
      <canvas ref={canvasRef} onClick={handleClick} aria-label={`Atlas-3D-Karte: ${nodeTitle}`} style={{ display: "block", width: "100%", height: "100%", minHeight: 480, touchAction: "none" }} />
      {status !== "ready" && (
        <div role="status" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: preset.colors.ink, background: preset.colors.parchment }}>
          {status === "error" ? "3D ist auf diesem Gerät nicht verfügbar." : "3D-Karte wird aufgebaut …"}
        </div>
      )}
      <div ref={bakeHostRef} aria-hidden style={{ position: "fixed", left: -100000, top: 0, width: 1600, height: 1000, pointerEvents: "none" }}>
        <AtlasViewer {...props} groundOnly />
      </div>
    </div>
  );
}
