"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";

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
    <div className="uwe-project-media">
      <div className="uwe-project-media-toolbar">
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Lädt hoch…" : "Bilder hinzufügen"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
          multiple
          hidden
          onChange={(event) => void handleUpload(event)}
          disabled={busy}
        />
        <span className="uwe-dashboard-muted">
          {images.length === 0
            ? "Noch keine Bilder"
            : `${images.length} Bild${images.length === 1 ? "" : "er"}`}
        </span>
      </div>

      {error ? <p className="uwe-hint uwe-hint-error">{error}</p> : null}

      {images.length > 0 ? (
        <ul className="uwe-project-media-grid">
          {images.map((image, index) => (
            <li key={image.id} className="uwe-project-media-item">
              <button
                type="button"
                className="uwe-project-media-thumb"
                onClick={() => setLightboxIndex(index)}
                aria-label={`${image.caption || image.originalFilename || "Bild"} groß anzeigen`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(image.id)} alt={image.caption || image.originalFilename || "Projektbild"} />
              </button>
              <button
                type="button"
                className="uwe-project-media-delete"
                onClick={() => void handleDelete(image.id)}
                disabled={busy}
                aria-label="Bild löschen"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="uwe-dashboard-muted">
          Lade Bilder hoch, um sie hier in der Mediathek zu sehen. Klicke ein Bild an, um es groß zu
          öffnen.
        </p>
      )}

      {active ? (
        <div
          className="uwe-project-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Bild-Großansicht"
          onClick={closeLightbox}
        >
          <button
            type="button"
            className="uwe-project-lightbox-close"
            onClick={closeLightbox}
            aria-label="Schließen"
          >
            ✕
          </button>
          {images.length > 1 ? (
            <button
              type="button"
              className="uwe-project-lightbox-nav uwe-project-lightbox-prev"
              onClick={(event) => {
                event.stopPropagation();
                showRelative(-1);
              }}
              aria-label="Vorheriges Bild"
            >
              ‹
            </button>
          ) : null}
          <figure className="uwe-project-lightbox-figure" onClick={(event) => event.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(active.id)} alt={active.caption || active.originalFilename || "Projektbild"} />
            {active.caption ? <figcaption>{active.caption}</figcaption> : null}
          </figure>
          {images.length > 1 ? (
            <button
              type="button"
              className="uwe-project-lightbox-nav uwe-project-lightbox-next"
              onClick={(event) => {
                event.stopPropagation();
                showRelative(1);
              }}
              aria-label="Nächstes Bild"
            >
              ›
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
