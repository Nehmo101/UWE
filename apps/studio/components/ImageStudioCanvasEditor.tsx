"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";

interface ImageStudioCanvasEditorProps {
  sourceImageUrl: string;
  onSave: (formData: FormData) => Promise<void>;
  projectId: string;
}

export function ImageStudioCanvasEditor({
  sourceImageUrl,
  onSave,
  projectId,
}: ImageStudioCanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !image.naturalWidth) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const radians = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const width = image.naturalWidth * cos + image.naturalHeight * sin;
    const height = image.naturalWidth * sin + image.naturalHeight * cos;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(radians);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    ctx.restore();
  }, [rotation]);

  function handleImageLoad(image: HTMLImageElement) {
    imageRef.current = image;
    setLoaded(true);
  }

  function rotateLeft() {
    setRotation((value) => (value + 270) % 360);
  }

  function rotateRight() {
    setRotation((value) => (value + 90) % 360);
  }

  useEffect(() => {
    if (loaded) {
      drawCanvas();
    }
  }, [loaded, drawCanvas]);

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setStatus(null);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1] ?? "";
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("imageBase64", base64);
      formData.set("title", "Canvas-Bearbeitung");
      await onSave(formData);
      setStatus("Gespeichert — neue Version angelegt.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Basis-Editor: Drehen und als neue Version speichern. Für KI-Inpainting den Generator auf der
        Projektseite nutzen.
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sourceImageUrl}
        alt="Quellbild"
        className="hidden"
        onLoad={(event) => handleImageLoad(event.currentTarget)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={rotateLeft} disabled={!loaded}>
          ↺ 90°
        </Button>
        <Button type="button" variant="secondary" onClick={rotateRight} disabled={!loaded}>
          ↻ 90°
        </Button>
        <Button type="button" variant="default" onClick={() => void handleSave()} disabled={!loaded || saving}>
          {saving ? "Speichern…" : "Als Version speichern"}
        </Button>
      </div>

      <canvas ref={canvasRef} className="max-w-full rounded-[var(--radius)] border border-border" />

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}
