"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPagePortalReleasedAction } from "@/app/actions";

interface PortalReleaseToggleProps {
  worldSlug: string;
  pageId: string;
  released: boolean;
  /**
   * `labeled`: Checkbox mit Beschriftung (Seitenansicht).
   * `compact`: nur Checkbox mit aria-label (Tabellenzelle).
   */
  variant?: "labeled" | "compact";
}

const TOGGLE_LABEL = "Diese Seite im Spieler-Wiki zeigen";

/**
 * Schaltet die Portal-Freigabe einer Seite direkt um — ohne den
 * Bearbeitungsmodus zu öffnen. Optimistisch: bei einem Fehler springt die
 * Checkbox zurück und die Meldung erscheint daneben.
 */
export function PortalReleaseToggle({
  worldSlug,
  pageId,
  released,
  variant = "labeled",
}: PortalReleaseToggleProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(released);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Nach router.refresh() liefert der Server den neuen Stand als Prop.
  useEffect(() => {
    setChecked(released);
  }, [released]);

  function handleChange(next: boolean) {
    setChecked(next);
    setError(null);
    startTransition(async () => {
      try {
        const result = await setPagePortalReleasedAction(worldSlug, pageId, next);
        if (!result.ok) {
          setChecked(!next);
          setError(result.message);
          return;
        }
        router.refresh();
      } catch {
        setChecked(!next);
        setError("Speichern fehlgeschlagen.");
      }
    });
  }

  const checkbox = (
    <input
      type="checkbox"
      className="size-4 accent-primary"
      checked={checked}
      disabled={pending}
      aria-label={variant === "compact" ? TOGGLE_LABEL : undefined}
      title={variant === "compact" ? TOGGLE_LABEL : undefined}
      onChange={(event) => handleChange(event.target.checked)}
    />
  );

  if (variant === "compact") {
    return (
      <span className="inline-flex items-center gap-1">
        {checkbox}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm">
        {checkbox}
        <span>{TOGGLE_LABEL}</span>
      </label>
      {pending && <p className="m-0 text-xs text-muted-foreground">Wird gespeichert…</p>}
      {error && <p className="m-0 text-xs text-destructive">{error}</p>}
    </div>
  );
}
