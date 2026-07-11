"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { Button, NavIcon } from "@/src/components/ui";

export interface ProjectImageItem {
  id: string;
  caption: string;
  originalFilename: string;
}

interface ProjectMediaLibraryProps {
  projectId: string;
  initialImages: ProjectImageItem[];
}

function imageUrl(imageId: string): string {
  return studioApiUrl(`/api/projects/images/${imageId}`);
}

/**
 * Client-side Mediathek for a personal project: upload images, browse them as a
 * thumbnail grid and open any image full-size in a lightbox overlay.
 */
export function ProjectMediaLibrary({ projectId, initialImages }: ProjectMediaLibraryProps) {
  const [images, setImages] = useState<ProjectImageItem[]>(initialImages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const showRelative = useCallback(
    (delta: number) => {
      setLightboxIndex((current) => {
        if (current === null || images.length === 0) return current;
        return (current + delta + images.length) % images.length;
      });
    },
    [images.length],
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeLightbox();
      else if (event.key === "ArrowRight") showRelative(1);
      else if (event.key === "ArrowLeft") showRelative(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, closeLightbox, showRelative]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || busy) return;

    setBusy(true);
    setError(null);
    try {
      const uploaded: ProjectImageItem[] = [];
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(studioApiUrl(`/api/projects/${projectId}/images`), {
          method: "POST",
          body,
          headers: { Accept: "application/json" },
        });
        const data = (await res.json()) as {
          id?: string;
          caption?: string;
          originalFilename?: string;
          error?: string;
        };
        if (!res.ok || !data.id) {
          throw new Error(data.error ?? "Upload fehlgeschlagen.");
        }
        uploaded.push({
          id: data.id,
          caption: data.caption ?? "",
          originalFilename: data.originalFilename ?? file.name,
        });
      }
      setImages((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(imageId: string): Promise<void> {
    if (busy) return;
    if (!window.confirm("Dieses Bild wirklich löschen?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(imageUrl(imageId), { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Löschen fehlgeschlagen.");
      }
      setImages((current) => current.filter((image) => image.id !== imageId));
      closeLightbox();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  const active = lightboxIndex !== null ? images[lightboxIndex] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? "Lädt hoch…" : "Bilder hinzufügen"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
          multiple
          hidden
          onChange={(event) => void handleUpload(event)}
          disabled={busy}
        />
        <span className="text-sm text-muted-foreground">
          {images.length === 0
            ? "Noch keine Bilder"
            : `${images.length} Bild${images.length === 1 ? "" : "er"}`}
        </span>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {images.length > 0 ? (
        <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2.5 p-0">
          {images.map((image, index) => (
            <li key={image.id} className="group relative aspect-square">
              <button
                type="button"
                className="block h-full w-full cursor-pointer overflow-hidden rounded-[var(--radius)] border border-border bg-background p-0 transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setLightboxIndex(index)}
                aria-label={`${image.caption || image.originalFilename || "Bild"} groß anzeigen`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(image.id)}
                  alt={image.caption || image.originalFilename || "Projektbild"}
                  className="block h-full w-full object-cover"
                />
              </button>
              <button
                type="button"
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => void handleDelete(image.id)}
                disabled={busy}
                aria-label="Bild löschen"
              >
                <NavIcon name="x" width={14} height={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Lade Bilder hoch, um sie hier in der Mediathek zu sehen. Klicke ein Bild an, um es groß zu
          öffnen.
        </p>
      )}

      {active ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-[clamp(1rem,4vw,3rem)]"
          role="dialog"
          aria-modal="true"
          aria-label="Bild-Großansicht"
          onClick={closeLightbox}
        >
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
            onClick={closeLightbox}
            aria-label="Schließen"
          >
            <NavIcon name="x" width={20} height={20} />
          </button>
          {images.length > 1 ? (
            <button
              type="button"
              className="absolute left-[clamp(0.5rem,3vw,2rem)] top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
              onClick={(event) => {
                event.stopPropagation();
                showRelative(-1);
              }}
              aria-label="Vorheriges Bild"
            >
              <NavIcon name="chevron-left" width={28} height={28} />
            </button>
          ) : null}
          <figure
            className="m-0 flex max-h-full max-w-full flex-col items-center gap-2.5"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(active.id)}
              alt={active.caption || active.originalFilename || "Projektbild"}
              className="max-h-[82vh] max-w-full rounded object-contain shadow-2xl"
            />
            {active.caption ? (
              <figcaption className="max-w-[60ch] text-center text-sm text-white/90">
                {active.caption}
              </figcaption>
            ) : null}
          </figure>
          {images.length > 1 ? (
            <button
              type="button"
              className="absolute right-[clamp(0.5rem,3vw,2rem)] top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
              onClick={(event) => {
                event.stopPropagation();
                showRelative(1);
              }}
              aria-label="Nächstes Bild"
            >
              <NavIcon name="chevron-right" width={28} height={28} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
