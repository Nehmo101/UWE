"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { releaseAllWorldPagesAction, type WorldReleaseMode } from "@/app/page-bulk-actions";

interface Props {
  worldSlug: string;
}

/**
 * Globales Freigeben aller Wissenstexte einer Welt — ein Klick statt Seite für
 * Seite. „Alle freigeben“ macht jede Seite Portal-sichtbar und veröffentlicht;
 * „Alle auf Nur-GM“ nimmt sie wieder aus dem Portal. dm_only-Blöcke bleiben
 * verborgen.
 */
export function WorldReleaseControl({ worldSlug }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(mode: WorldReleaseMode) {
    const confirmText =
      mode === "release"
        ? "Alle Wissenstexte dieser Welt für Spieler freigeben (Portal sichtbar + veröffentlicht)? dm_only-Blöcke bleiben verborgen. Rückgängig über das Aktivitätsprotokoll."
        : "Alle Wissenstexte dieser Welt wieder auf „Nur GM“ setzen (aus dem Portal nehmen)?";
    if (!window.confirm(confirmText)) return;

    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await releaseAllWorldPagesAction(worldSlug, mode);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setMessage(result.message);
        router.refresh();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Aktion fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
        onClick={() => run("release")}
        disabled={isPending}
      >
        {isPending ? "Wird angewendet…" : "Alle freigeben"}
      </button>
      <button
        type="button"
        className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-60"
        onClick={() => run("hide")}
        disabled={isPending}
      >
        Alle auf Nur-GM
      </button>
      {error ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : message ? (
        <span className="text-sm text-muted-foreground">✓ {message}</span>
      ) : null}
    </div>
  );
}
