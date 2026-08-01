"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TransferPreview } from "@uwe/doc-import/transfer";
import {
  listTransferTargetWorldsAction,
  previewTransferPagesAction,
  transferPagesAction,
  type TransferTargetWorld,
} from "@/app/page-transfer-actions";

interface Props {
  worldSlug: string;
  selectedIds: string[];
  clearSelection: () => void;
}

const SELECT_CLASS = "rounded-md border border-border bg-background px-2 py-1 text-sm";
const BUTTON_CLASS =
  "inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50";

/**
 * Ausgewählte Seiten in eine andere Welt übernehmen.
 *
 * Der Weg für fremdes Material: der gekaufte Band liegt in einer Werkstatt-Welt
 * ohne Spieler, hier wandern die kuratierten Teile in die eigene Welt. Vor dem
 * Schreiben zeigt die Vorschau, was mitkommt und welche Verweise danach ins
 * Leere zeigen — `[[Links]]` reisen als Text mit und lösen sich in der Zielwelt
 * neu auf.
 */
export function PageBatchTransferPanel({ worldSlug, selectedIds, clearSelection }: Props) {
  const router = useRouter();
  const [worlds, setWorlds] = useState<TransferTargetWorld[]>([]);
  const [targetWorldSlug, setTargetWorldSlug] = useState("");
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadWorlds = () => {
      void listTransferTargetWorldsAction(worldSlug)
        .then(setWorlds)
        .catch(() => setError("Zielwelten konnten nicht geladen werden."));
    };

    loadWorlds();
  }, [worldSlug]);

  const handlePreview = useCallback(async () => {
    if (!targetWorldSlug) {
      setError("Bitte eine Zielwelt wählen.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      setPreview(
        await previewTransferPagesAction({
          sourceWorldSlug: worldSlug,
          targetWorldSlug,
          pageIds: selectedIds,
          includeDescendants,
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Vorschau fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [includeDescendants, selectedIds, targetWorldSlug, worldSlug]);

  const handleTransfer = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await transferPagesAction({
        sourceWorldSlug: worldSlug,
        targetWorldSlug,
        pageIds: selectedIds,
        includeDescendants,
      });

      setMessage(
        `${result.created} Seite(n) übernommen${result.failed > 0 ? `, ${result.failed} fehlgeschlagen` : ""}.`,
      );
      setPreview(null);
      clearSelection();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Übernahme fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [clearSelection, includeDescendants, router, selectedIds, targetWorldSlug, worldSlug]);

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={SELECT_CLASS}
          value={targetWorldSlug}
          onChange={(event) => {
            setTargetWorldSlug(event.target.value);
            setPreview(null);
          }}
          aria-label="Zielwelt"
        >
          <option value="">Zielwelt wählen…</option>
          {worlds.map((world) => (
            <option key={world.slug} value={world.slug}>
              {world.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeDescendants}
            onChange={(event) => {
              setIncludeDescendants(event.target.checked);
              setPreview(null);
            }}
          />
          Unterseiten mitnehmen
        </label>

        <button type="button" className={BUTTON_CLASS} onClick={handlePreview} disabled={loading}>
          Vorschau
        </button>

        {preview ? (
          <button type="button" className={BUTTON_CLASS} onClick={handleTransfer} disabled={loading}>
            {preview.items.length} Seite(n) übernehmen
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">✓ {message}</p> : null}

      {preview ? (
        <div className="space-y-2 text-sm">
          {preview.warnings.map((warning) => (
            <p key={warning} className="text-muted-foreground">
              {warning}
            </p>
          ))}
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {preview.items.map((item) => (
              <li
                key={item.sourcePageId}
                style={{ paddingInlineStart: `${item.depth * 1.25}rem` }}
                className={item.implicit ? "text-muted-foreground" : undefined}
              >
                {item.title} <span className="text-xs">/{item.slug}</span>
                {item.implicit ? <span className="text-xs"> · als Unterseite</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
