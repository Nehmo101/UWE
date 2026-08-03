"use client";

import { useRef, useState, useEffect } from "react";
import { Button, Input, Label, Textarea } from "@/src/components/ui";
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
  enabled: boolean;
  pageId?: string;
  projectId?: string;
  linkTargetType?: string;
  defaultPrompt?: string;
  defaultTitle?: string;
  sourceAssetUrl?: string | null;
}

const INPAINT_TASKS = new Set(["inpaint", "edit", "remove_background", "variant"]);
const LOCAL_ONLY_TASKS = new Set(["inpaint", "edit", "remove_background"]);

const FIELD_CLASS = "flex flex-col gap-1.5 text-sm";

/** TODO(design-kit): native Selects bleiben — Server-Action-Formular (FormData) braucht
    name-Attribut, teils zusätzlich an lokalen State gebunden (Welt/Operation/Provider steuern
    abhängige Felder), siehe gleiches Muster in SessionDetailClient.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
  enabled,
  pageId,
  projectId,
  linkTargetType = "page",
  defaultPrompt = "",
  defaultTitle = "",
  sourceAssetUrl = null,
}: ImageStudioJobFormProps) {
  const [task, setTask] = useState("generate");
  const [worldSlug, setWorldSlug] = useState(defaultWorldSlug || worlds[0]?.slug || "");
  const [sourcePreview, setSourcePreview] = useState<string | null>(sourceAssetUrl);
  const [sourceBase64, setSourceBase64] = useState("");
  const [maskBase64, setMaskBase64] = useState("");
  const [layerMode, setLayerMode] = useState(false);
  const [layerStatus, setLayerStatus] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!sourceAssetUrl || sourceBase64) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(sourceAssetUrl);
        if (!response.ok) {
          return;
        }
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = () => {
          if (cancelled) return;
          const result = typeof reader.result === "string" ? reader.result : "";
          const base64 = result.includes(",") ? result.split(",")[1] ?? "" : result;
          setSourceBase64(base64);
          setSourcePreview(result);
        };
        reader.readAsDataURL(blob);
      } catch {
        // Prefill is best-effort only.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceAssetUrl, sourceBase64]);

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
    <form ref={formRef} action={action} className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {pageId && <input type="hidden" name="pageId" value={pageId} />}
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      {pageId && <input type="hidden" name="linkTargetType" value={linkTargetType} />}
      <input type="hidden" name="sourceImageBase64" value={sourceBase64} />
      <input type="hidden" name="maskBase64" value={maskBase64} />

      {pageId && <input type="hidden" name="linkTargetId" value={pageId} />}

      <label className={FIELD_CLASS}>
        Prompt-Kontext
        <select name="contextMode" defaultValue="prompt_only" className={NATIVE_SELECT_CLASS}>
          <option value="prompt_only">Nur Prompt (Cloud-sicher)</option>
          <option value="page_context">Seiten-Kontext (nur Maschinenraum)</option>
          <option value="brain_context">Brain/Welt-Kontext (nur Maschinenraum)</option>
          <option value="object_context">Aktuelles Objekt (nur Maschinenraum)</option>
        </select>
      </label>
      <p className="text-sm text-muted-foreground">
        Privater Welt-/Brain-/Objekt-Kontext wird nicht an Cloud-Provider gesendet.
      </p>

      <label className={FIELD_CLASS}>
        Welt
        <select
          name="worldSlug"
          required
          value={worldSlug}
          onChange={(event) => setWorldSlug(event.target.value)}
          className={NATIVE_SELECT_CLASS}
        >
          {worlds.map((world) => (
            <option key={world.slug} value={world.slug}>
              {world.name}
            </option>
          ))}
        </select>
      </label>

      <label className={FIELD_CLASS}>
        Operation
        <select
          name="task"
          value={task}
          onChange={(event) => setTask(event.target.value)}
          className={NATIVE_SELECT_CLASS}
        >
          {Object.entries(operationLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {showVariantCount && (
        <label className={FIELD_CLASS}>
          Varianten (1–4)
          <Input name="variantCount" type="number" min={1} max={4} defaultValue={2} />
        </label>
      )}

      {showInpaintFields && (
        <>
          {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={layerMode}
              onChange={(event) => setLayerMode(event.target.checked)}
              className="size-4 rounded border-input"
            />
            Layering-Modus (mehrere Bilder übereinander legen)
          </label>
          {layerMode ? (
            <label className={FIELD_CLASS}>
              Layer-Bilder (Reihenfolge = Stapel von unten nach oben)
              {/* TODO(design-kit): natives File-Input — Kit hat noch keine File-Input-Komponente. */}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => void handleLayerFilesChange(event)}
                className="text-sm text-foreground"
              />
            </label>
          ) : (
            <label className={FIELD_CLASS}>
              Quellbild
              {/* TODO(design-kit): natives File-Input — Kit hat noch keine File-Input-Komponente. */}
              <input
                type="file"
                accept="image/*"
                onChange={handleSourceFileChange}
                className="text-sm text-foreground"
              />
            </label>
          )}
          {layerStatus && <p className="text-sm text-muted-foreground">{layerStatus}</p>}
          {(task === "inpaint" || task === "edit") && (
            <div className="flex flex-col gap-2">
              <Label>Maske zeichnen (Inpaint-Bereich)</Label>
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

      <label className={FIELD_CLASS}>
        Titel (optional)
        <Input name="title" type="text" placeholder="NPC-Portrait Gandalf" defaultValue={defaultTitle} />
      </label>

      <label className={FIELD_CLASS}>
        Prompt
        <Textarea
          name="prompt"
          required
          rows={4}
          placeholder="Episches DnD-Portrait …"
          defaultValue={defaultPrompt}
        />
      </label>

      <Button type="submit" disabled={!enabled}>
        Generieren (Job)
      </Button>
    </form>
  );
}
