"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PAGE_TYPE_LABELS,
  ResponsiveTable,
} from "@uwe/shared-ui";
import {
  applyWikitextConversionAction,
  previewWikitextConversionAction,
  type WikitextConvertPreviewView,
} from "@/app/worlds/[worldSlug]/wikitext-convert-actions";

function typeLabel(type: string): string {
  return PAGE_TYPE_LABELS[type as keyof typeof PAGE_TYPE_LABELS] ?? type;
}

interface Props {
  worldSlug: string;
  selectedIds: string[];
  clearSelection: () => void;
}

/**
 * Wikitext-Konvertierung für eine Mehrfachauswahl aus der Seitentabelle —
 * gleiche Engine wie "Alle Wikitexte konvertieren" (siehe .../import),
 * nur auf die ausgewählten Seiten begrenzt. Erst Vorschau, dann Anwenden,
 * damit Struktur-/Verlinkungs-/Typänderungen nicht blind angewendet werden.
 */
export function PageBatchConvertPanel({ worldSlug, selectedIds, clearSelection }: Props) {
  const router = useRouter();
  const [detectType, setDetectType] = useState(true);
  const [preview, setPreview] = useState<WikitextConvertPreviewView | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      setPreview(
        await previewWikitextConversionAction(worldSlug, { detectType, pageIds: selectedIds }),
      );
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : "Vorschau fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [worldSlug, selectedIds, detectType]);

  const handleApply = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await applyWikitextConversionAction(worldSlug, {
        detectType,
        pageIds: selectedIds,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setPreview(null);
      clearSelection();
      router.refresh();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Konvertierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [worldSlug, selectedIds, detectType, clearSelection, router]);

  const hasChanges = Boolean(preview && (preview.changedBlockCount > 0 || preview.typeChangeCount > 0));

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={detectType}
          onChange={(event) => setDetectType(event.target.checked)}
        />
        <span>
          Seitentyp aus Titel, Inhalt und Tags erkennen (z. B. <code>Kategorie: NPC</code>)
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-md border border-border px-3 hover:bg-muted disabled:opacity-60"
          onClick={handlePreview}
          disabled={loading || selectedIds.length === 0}
        >
          {loading && !preview ? "Prüft…" : `Vorschau für ${selectedIds.length} Seite(n)`}
        </button>

        {hasChanges && (
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            onClick={handleApply}
            disabled={loading}
          >
            {loading
              ? "Konvertiert…"
              : `Konvertierung anwenden (${preview!.changedBlockCount + preview!.typeChangeCount})`}
          </button>
        )}
      </div>

      {error && <span className="text-destructive">{error}</span>}
      {message && !error && <span className="text-muted-foreground">✓ {message}</span>}

      {preview && !hasChanges && (
        <span className="text-muted-foreground">
          ✓ Ausgewählte Seiten sind bereits konvertiert — nichts zu tun.
        </span>
      )}

      {preview && preview.changedBlockCount > 0 && (
        <p className="text-muted-foreground">
          {preview.changedBlockCount} von {preview.totalBlocks} Textblöcken werden geändert:{" "}
          {preview.addedLinkCount} neue Verbindung(en), {preview.structuredBlockCount} strukturell
          bereinigt.
        </p>
      )}

      {preview && preview.typeChanges.length > 0 && (
        <ResponsiveTable
          caption="Seitentyp-Änderungen"
          rowKey={(change) => change.pageId}
          rows={preview.typeChanges}
          columns={[
            {
              key: "page",
              label: "Seite",
              primary: true,
              render: (change) => (
                <Link href={change.pageHref} className="hover:underline">
                  {change.pageTitle}
                </Link>
              ),
            },
            { key: "from", label: "Bisher", render: (change) => typeLabel(change.fromType) },
            {
              key: "to",
              label: "Neu (erkannt)",
              render: (change) => <span className="font-medium">{typeLabel(change.toType)}</span>,
            },
          ]}
        />
      )}
    </div>
  );
}
