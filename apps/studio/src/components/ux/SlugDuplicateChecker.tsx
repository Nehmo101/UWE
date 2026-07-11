"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useEffect, useState } from "react";

interface SlugDuplicateCheckerProps {
  worldSlug: string;
  /** Slug input element name (listens to sibling form field) */
  slugInputName?: string;
}

export function SlugDuplicateChecker({
  worldSlug,
  slugInputName = "slug",
}: SlugDuplicateCheckerProps) {
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "free" | "taken">("idle");

  useEffect(() => {
    const trimmed = slug.trim();
    if (!trimmed) {
      setStatus("idle");
      return undefined;
    }

    setStatus("checking");
    const timer = window.setTimeout(() => {
      void fetch(
        studioApiUrl(
          `/api/worlds/${encodeURIComponent(worldSlug)}/pages/check-slug?slug=${encodeURIComponent(trimmed)}`,
        ),
      )
        .then((response) => response.json())
        .then((data: { available?: boolean }) => {
          setStatus(data.available ? "free" : "taken");
        })
        .catch(() => setStatus("idle"));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [slug, worldSlug]);

  return (
    <>
      <input
        type="hidden"
        name="_slugWatcher"
        value={slug}
        readOnly
        aria-hidden
        tabIndex={-1}
        style={{ display: "none" }}
      />
      <label>
        Slug (optional)
        <input
          name={slugInputName}
          placeholder="leer lassen für automatischen Slug"
          onChange={(event) => setSlug(event.target.value)}
        />
        {status === "checking" ? (
          <small className="text-xs text-muted-foreground">Slug wird geprüft…</small>
        ) : null}
        {status === "free" ? (
          <small className="text-xs text-muted-foreground" style={{ color: "var(--uwe-success, #16a34a)" }}>
            Slug ist verfügbar.
          </small>
        ) : null}
        {status === "taken" ? (
          <small className="text-sm text-destructive">Slug bereits vergeben — bitte anderen wählen.</small>
        ) : null}
      </label>
    </>
  );
}
