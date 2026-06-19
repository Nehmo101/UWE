"use client";

import { useRef, useState } from "react";

interface WorldOption {
  slug: string;
  name: string;
}

interface ImageStudioJobFormProps {
  action: (formData: FormData) => Promise<void>;
  worlds: WorldOption[];
  operationLabels: Record<string, string>;
  defaultWorldSlug?: string;
  defaultProviderMode: string;
  enabled: boolean;
  pageId?: string;
  linkTargetType?: string;
}

const INPAINT_TASKS = new Set(["inpaint", "edit", "remove_background", "variant"]);

export function ImageStudioJobForm({
  action,
  worlds,
  operationLabels,
  defaultWorldSlug = "",
  defaultProviderMode,
  enabled,
  pageId,
  linkTargetType = "page",
}: ImageStudioJobFormProps) {
  const [task, setTask] = useState("generate");
  const [worldSlug, setWorldSlug] = useState(defaultWorldSlug || worlds[0]?.slug || "");
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [sourceBase64, setSourceBase64] = useState("");
  const [maskBase64, setMaskBase64] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const showInpaintFields = INPAINT_TASKS.has(task);
  const showVariantCount = task === "variant";

  function handleSourceFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] ?? "" : result;
      setSourceBase64(base64);
      setSourcePreview(result);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          setMaskBase64("");
        }
      }
    };
    reader.readAsDataURL(file);
  }

  function pointerPos(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function paintMask(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const { x, y } = pointerPos(event);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    setMaskBase64(canvas.toDataURL("image/png").split(",")[1] ?? "");
  }

  return (
    <form action={action} className="uwe-form">
      {pageId && <input type="hidden" name="pageId" value={pageId} />}
      {pageId && <input type="hidden" name="linkTargetType" value={linkTargetType} />}
      <input type="hidden" name="sourceImageBase64" value={sourceBase64} />
      <input type="hidden" name="maskBase64" value={maskBase64} />

      {pageId && <input type="hidden" name="linkTargetId" value={pageId} />}

      <label>
        Prompt-Kontext
        <select name="contextMode" defaultValue="prompt_only">
          <option value="prompt_only">Nur Prompt (Cloud-sicher)</option>
          <option value="page_context">Seiten-Kontext (nur RTX)</option>
          <option value="brain_context">Brain/Welt-Kontext (nur RTX)</option>
          <option value="object_context">Aktuelles Objekt (nur RTX)</option>
        </select>
      </label>
      <p className="uwe-hint">
        Privater Welt-/Brain-/Objekt-Kontext wird nicht an Cloud-Provider gesendet.
      </p>

      <label>
        Welt
        <select
          name="worldSlug"
          required
          value={worldSlug}
          onChange={(event) => setWorldSlug(event.target.value)}
        >
          {worlds.map((world) => (
            <option key={world.slug} value={world.slug}>
              {world.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Operation
        <select name="task" value={task} onChange={(event) => setTask(event.target.value)}>
          {Object.entries(operationLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Provider
        <select name="providerMode" defaultValue={defaultProviderMode}>
          <option value="auto">Auto (RTX → Cloud)</option>
          <option value="local_rtx">Nur RTX (lokal)</option>
          <option value="cloud">Cloud</option>
        </select>
      </label>

      {showVariantCount && (
        <label>
          Varianten (1–4)
          <input name="variantCount" type="number" min={1} max={4} defaultValue={2} />
        </label>
      )}

      {showInpaintFields && (
        <>
          <label>
            Quellbild
            <input type="file" accept="image/*" onChange={handleSourceFileChange} />
          </label>
          {sourcePreview && (
            <div
              role="img"
              aria-label="Quellbild"
              style={{
                width: "100%",
                maxWidth: "20rem",
                height: "12rem",
                backgroundImage: `url(${sourcePreview})`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                border: "1px solid var(--uwe-border, #333)",
              }}
            />
          )}
          {(task === "inpaint" || task === "edit") && (
            <label>
              Maske zeichnen (Inpaint-Bereich)
              <canvas
                ref={canvasRef}
                width={512}
                height={512}
                style={{
                  width: "100%",
                  maxWidth: "20rem",
                  aspectRatio: "1",
                  border: "1px solid var(--uwe-border, #333)",
                  touchAction: "none",
                  background: "rgba(0,0,0,0.2)",
                }}
                onPointerDown={(event) => {
                  drawingRef.current = true;
                  paintMask(event);
                }}
                onPointerMove={(event) => {
                  if (drawingRef.current) paintMask(event);
                }}
                onPointerUp={() => {
                  drawingRef.current = false;
                }}
                onPointerLeave={() => {
                  drawingRef.current = false;
                }}
              />
            </label>
          )}
        </>
      )}

      <label>
        Titel (optional)
        <input name="title" type="text" placeholder="NPC-Portrait Gandalf" />
      </label>

      <label>
        Prompt
        <textarea name="prompt" required rows={4} placeholder="Episches DnD-Portrait …" />
      </label>

      <button type="submit" className="uwe-btn uwe-btn-primary" disabled={!enabled}>
        Generieren (Job)
      </button>
    </form>
  );
}
