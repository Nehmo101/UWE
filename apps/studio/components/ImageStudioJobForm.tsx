"use client";

import { useRef, useState } from "react";
import { ImageStudioMaskCanvas } from "./ImageStudioMaskCanvas";

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
const LOCAL_ONLY_TASKS = new Set(["inpaint", "edit", "remove_background"]);

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compositeLayerImages(files: File[]): Promise<{ preview: string; base64: string }> {
  if (files.length === 0) {
    throw new Error("Keine Layer-Bilder ausgewählt.");
  }

  const images = await Promise.all(files.map((file) => loadImageFromFile(file)));
  const width = Math.max(...images.map((image) => image.naturalWidth || image.width));
  const height = Math.max(...images.map((image) => image.naturalHeight || image.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas nicht verfügbar.");
  }

  ctx.clearRect(0, 0, width, height);
  for (const image of images) {
    ctx.drawImage(image, 0, 0, width, height);
  }

  const preview = canvas.toDataURL("image/png");
  return {
    preview,
    base64: preview.split(",")[1] ?? "",
  };
}

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
  const [layerMode, setLayerMode] = useState(false);
  const [layerStatus, setLayerStatus] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const showInpaintFields = INPAINT_TASKS.has(task);
  const showVariantCount = task === "variant";
  const requiresLocalProvider = LOCAL_ONLY_TASKS.has(task);

  function handleSourceFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] ?? "" : result;
      setSourceBase64(base64);
      setSourcePreview(result);
      setMaskBase64("");
    };
    reader.readAsDataURL(file);
  }

  async function handleLayerFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setLayerStatus("Layer werden zusammengefügt…");
    try {
      const composite = await compositeLayerImages(files);
      setSourceBase64(composite.base64);
      setSourcePreview(composite.preview);
      setMaskBase64("");
      setLayerStatus(`${files.length} Layer zu einem Quellbild kombiniert.`);
    } catch {
      setLayerStatus("Layer konnten nicht kombiniert werden.");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (requiresLocalProvider && !sourceBase64) {
      event.preventDefault();
      window.alert("Quellbild ist für diese Operation erforderlich.");
      return;
    }
    if (task === "inpaint" && !maskBase64) {
      event.preventDefault();
      window.alert("Bitte eine Maske für Inpainting zeichnen.");
      return;
    }
  }

  return (
    <form ref={formRef} action={action} className="uwe-form" onSubmit={handleSubmit}>
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
        <select
          name="providerMode"
          defaultValue={requiresLocalProvider ? "local_rtx" : defaultProviderMode}
          key={task}
        >
          <option value="auto" disabled={requiresLocalProvider}>
            Auto (RTX → Cloud)
          </option>
          <option value="local_rtx">Nur RTX (lokal)</option>
          <option value="cloud" disabled={requiresLocalProvider}>
            Cloud
          </option>
        </select>
      </label>
      {requiresLocalProvider && (
        <p className="uwe-hint">Inpaint/Edit erfordert RTX — Cloud ist für diese Operation deaktiviert.</p>
      )}

      {showVariantCount && (
        <label>
          Varianten (1–4)
          <input name="variantCount" type="number" min={1} max={4} defaultValue={2} />
        </label>
      )}

      {showInpaintFields && (
        <>
          <label className="uwe-checkbox-row">
            <input
              type="checkbox"
              checked={layerMode}
              onChange={(event) => setLayerMode(event.target.checked)}
            />
            Layering-Modus (mehrere Bilder übereinander legen)
          </label>
          {layerMode ? (
            <label>
              Layer-Bilder (Reihenfolge = Stapel von unten nach oben)
              <input type="file" accept="image/*" multiple onChange={(event) => void handleLayerFilesChange(event)} />
            </label>
          ) : (
            <label>
              Quellbild
              <input type="file" accept="image/*" onChange={handleSourceFileChange} />
            </label>
          )}
          {layerStatus && <p className="uwe-hint">{layerStatus}</p>}
          {(task === "inpaint" || task === "edit") && (
            <div>
              <p className="uwe-label">Maske zeichnen (Inpaint-Bereich)</p>
              <ImageStudioMaskCanvas
                sourcePreview={sourcePreview}
                sourceBase64={sourceBase64}
                onMaskChange={setMaskBase64}
                disabled={!enabled}
              />
            </div>
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

      <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" disabled={!enabled}>
        Generieren (Job)
      </button>
    </form>
  );
}
