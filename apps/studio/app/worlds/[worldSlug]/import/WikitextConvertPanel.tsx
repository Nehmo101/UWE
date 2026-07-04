"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PAGE_TYPE_LABELS } from "@uwe/shared-ui";
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

function typeLabel(type: string): string {
  return PAGE_TYPE_LABELS[type as keyof typeof PAGE_TYPE_LABELS] ?? type;
}

interface Props {
  worldSlug: string;
}

export function WikitextConvertPanel({ worldSlug }: Props) {
  const [preview, setPreview] = useState<WikitextConvertPreviewView | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detectType, setDetectType] = useState(true);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResultMessage(null);

    try {
      setPreview(await previewWikitextConversionAction(worldSlug, { detectType }));
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
  }, [worldSlug, detectType]);

  const handleApply = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await applyWikitextConversionAction(worldSlug, { detectType });
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
  }, [worldSlug, detectType]);

  return (
    <section className="uwe-panel">
      <h2>Alle Wikitexte konvertieren</h2>
      <p className="uwe-panel-intro">
        Konvertiert alle bestehenden Textblöcke dieser Welt: Erwähnungen anderer
        Seiten (Titel und Aliase) werden als <code>[[Wikilinks]]</code> verbunden,
        und die Markdown-Struktur wird vereinheitlicht (Überschriften, Listen,
        Leerzeilen). Optional wird der Seitentyp aus einem <code>Kategorie:</code>-
        bzw. <code>Typ:</code>-Marker im Text abgeleitet. Bestehende Links,
        Code-Blöcke und Statblocks bleiben unverändert. Jede Änderung ist über das
        Aktivitätsprotokoll rückgängig machbar.
      </p>

      <label className="uwe-checkbox-row">
        <input
          type="checkbox"
          checked={detectType}
          onChange={(event) => setDetectType(event.target.checked)}
        />
        <span>
          Seitentyp aus Inhalt erkennen (z. B. <code>Kategorie: NPC</code> →{" "}
          Seitentyp <strong>NPC</strong>)
        </span>
      </label>

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

      {preview && preview.changedBlockCount === 0 && preview.typeChangeCount === 0 && (
        <p className="uwe-inspector-ok" role="status">
          ✓ Alle {preview.totalBlocks} Textblöcke auf {preview.totalPages} Seiten sind
          bereits konvertiert — nichts zu tun.
        </p>
      )}

      {preview && (preview.changedBlockCount > 0 || preview.typeChangeCount > 0) && (
        <>
          <p className="uwe-panel-intro">
            {preview.changedBlockCount} von {preview.totalBlocks} Textblöcken werden
            geändert: {preview.addedLinkCount} neue Verbindung(en),{" "}
            {preview.structuredBlockCount} Block/Blöcke strukturell bereinigt
            {preview.typeChangeCount > 0
              ? `, ${preview.typeChangeCount} Seitentyp(en) aus dem Inhalt gesetzt`
              : ""}
            . Die Vorschau ändert keine Daten.
          </p>

          {preview.changedBlockCount > 0 && (
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
          )}

          {preview.typeChanges.length > 0 && (
            <>
              <h3 className="uwe-panel-subhead">Seitentyp-Änderungen</h3>
              <table className="uwe-page-table">
                <thead>
                  <tr>
                    <th>Seite</th>
                    <th>Bisher</th>
                    <th>Neu (aus Inhalt)</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.typeChanges.map((change) => (
                    <tr key={change.pageId}>
                      <td>
                        <Link href={change.pageHref}>{change.pageTitle}</Link>
                      </td>
                      <td>{typeLabel(change.fromType)}</td>
                      <td>
                        <strong>{typeLabel(change.toType)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="uwe-form-actions">
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary"
              onClick={handleApply}
              disabled={loading}
            >
              {loading
                ? "Konvertiert…"
                : `Konvertierung anwenden (${preview.changedBlockCount + preview.typeChangeCount})`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
