"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  applyWikitextConversionAction,
  previewWikitextConversionAction,
  type WikitextConvertPreviewView,
} from "../wikitext-convert-actions";

const BLOCK_TYPE_LABELS: Record<string, string> = {
  rich_text: "Text",
  gm_note: "GM-Notiz",
  player_text: "Spielertext",
};

interface Props {
  worldSlug: string;
}

export function WikitextConvertPanel({ worldSlug }: Props) {
  const [preview, setPreview] = useState<WikitextConvertPreviewView | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResultMessage(null);

    try {
      setPreview(await previewWikitextConversionAction(worldSlug));
    } catch (previewError) {
      setPreview(null);
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Vorschau fehlgeschlagen.",
      );
    } finally {
      setLoading(false);
    }
  }, [worldSlug]);

  const handleApply = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await applyWikitextConversionAction(worldSlug);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setResultMessage(result.message);
      setPreview(null);
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : "Konvertierung fehlgeschlagen.",
      );
    } finally {
      setLoading(false);
    }
  }, [worldSlug]);

  return (
    <section className="uwe-panel">
      <h2>Alle Wikitexte konvertieren</h2>
      <p className="uwe-panel-intro">
        Konvertiert alle bestehenden Textblöcke dieser Welt: Erwähnungen anderer
        Seiten (Titel und Aliase) werden als <code>[[Wikilinks]]</code> verbunden,
        und die Markdown-Struktur wird vereinheitlicht (Überschriften, Listen,
        Leerzeilen). Bestehende Links, Code-Blöcke und Statblocks bleiben
        unverändert. Jede Änderung ist über das Aktivitätsprotokoll rückgängig
        machbar.
      </p>

      <div className="uwe-form-actions">
        <button
          type="button"
          className="uwe-v2-btn"
          onClick={handlePreview}
          disabled={loading}
        >
          {loading && !preview ? "Prüft…" : "Vorschau erstellen"}
        </button>
      </div>

      {error && <p className="uwe-flash uwe-flash-error">{error}</p>}
      {resultMessage && (
        <p className="uwe-inspector-ok" role="status">
          ✓ {resultMessage}{" "}
          <Link href={`/worlds/${worldSlug}/graph`}>Verbindungen im Graph ansehen →</Link>
        </p>
      )}

      {preview && preview.changedBlockCount === 0 && (
        <p className="uwe-inspector-ok" role="status">
          ✓ Alle {preview.totalBlocks} Textblöcke auf {preview.totalPages} Seiten sind
          bereits konvertiert — nichts zu tun.
        </p>
      )}

      {preview && preview.changedBlockCount > 0 && (
        <>
          <p className="uwe-panel-intro">
            {preview.changedBlockCount} von {preview.totalBlocks} Textblöcken werden
            geändert: {preview.addedLinkCount} neue Verbindung(en),{" "}
            {preview.structuredBlockCount} Block/Blöcke strukturell bereinigt. Die
            Vorschau ändert keine Daten.
          </p>

          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Seite</th>
                <th>Block</th>
                <th>Struktur</th>
                <th>Neue Verbindungen</th>
              </tr>
            </thead>
            <tbody>
              {preview.pages.map((page) =>
                page.blocks.map((block, index) => (
                  <tr key={block.blockId}>
                    <td>
                      {index === 0 ? (
                        <Link href={page.pageHref}>{page.pageTitle}</Link>
                      ) : (
                        ""
                      )}
                    </td>
                    <td>{BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType}</td>
                    <td>{block.structured ? "bereinigt" : "—"}</td>
                    <td>
                      {block.addedLinks.length > 0
                        ? block.addedLinks.map((link) =>
                            link.matched === link.target
                              ? `[[${link.target}]]`
                              : `[[${link.target}|${link.matched}]]`,
                          ).join(", ")
                        : "—"}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>

          <div className="uwe-form-actions">
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary"
              onClick={handleApply}
              disabled={loading}
            >
              {loading ? "Konvertiert…" : `Konvertierung anwenden (${preview.changedBlockCount})`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
