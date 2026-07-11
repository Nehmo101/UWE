"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PAGE_TYPE_LABELS } from "@uwe/shared-ui";
import {
  applyWikitextConversionAction,
  previewWikitextConversionAction,
  type WikitextConvertPreviewView,
} from "../wikitext-convert-actions";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

const BLOCK_TYPE_LABELS: Record<string, string> = {
  rich_text: "Text",
  gm_note: "GM-Notiz",
  player_text: "Spielertext",
};

function typeLabel(type: string): string {
  return PAGE_TYPE_LABELS[type as keyof typeof PAGE_TYPE_LABELS] ?? type;
}

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

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
    <Card>
      <CardHeader>
        <CardTitle>Alle Wikitexte konvertieren</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Konvertiert alle bestehenden Textblöcke dieser Welt: Erwähnungen anderer
          Seiten (Titel und Aliase) werden als <code>[[Wikilinks]]</code> verbunden,
          und die Markdown-Struktur wird vereinheitlicht (Überschriften, Listen,
          Leerzeilen). Optional wird der Seitentyp aus einem <code>Kategorie:</code>-
          bzw. <code>Typ:</code>-Marker im Text abgeleitet. Bestehende Links,
          Code-Blöcke und Statblocks bleiben unverändert. Jede Änderung ist über das
          Aktivitätsprotokoll rückgängig machbar.
        </p>

        {/* TODO(design-kit): natives Checkbox-Element — Kit hat noch keine Checkbox-Komponente. */}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={detectType} onChange={(event) => setDetectType(event.target.checked)} className="h-4 w-4 rounded border-input" />
          <span>
            Seitentyp aus Inhalt erkennen (z. B. <code>Kategorie: NPC</code> →{" "}
            Seitentyp <strong>NPC</strong>)
          </span>
        </label>

        <Button type="button" disabled={loading} onClick={handlePreview} className="self-start">
          {loading && !preview ? "Prüft…" : "Vorschau erstellen"}
        </Button>

        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}
        {resultMessage && (
          <Alert tone="success" role="status" icon="circle-check">
            {resultMessage}{" "}
            <Link href={`/worlds/${worldSlug}/graph`}>Verbindungen im Graph ansehen →</Link>
          </Alert>
        )}

        {preview && preview.changedBlockCount === 0 && preview.typeChangeCount === 0 && (
          <Alert tone="success" role="status" icon="circle-check">
            Alle {preview.totalBlocks} Textblöcke auf {preview.totalPages} Seiten sind
            bereits konvertiert — nichts zu tun.
          </Alert>
        )}

        {preview && (preview.changedBlockCount > 0 || preview.typeChangeCount > 0) && (
          <>
            <p className="text-sm text-muted-foreground">
              {preview.changedBlockCount} von {preview.totalBlocks} Textblöcken werden
              geändert: {preview.addedLinkCount} neue Verbindung(en),{" "}
              {preview.structuredBlockCount} Block/Blöcke strukturell bereinigt
              {preview.typeChangeCount > 0
                ? `, ${preview.typeChangeCount} Seitentyp(en) aus dem Inhalt gesetzt`
                : ""}
              . Die Vorschau ändert keine Daten.
            </p>

            {preview.changedBlockCount > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>Seite</th>
                      <th className={TH_CLASS}>Block</th>
                      <th className={TH_CLASS}>Struktur</th>
                      <th className={TH_CLASS}>Neue Verbindungen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.pages.map((page) =>
                      page.blocks.map((block, index) => (
                        <tr key={block.blockId}>
                          <td className={TD_CLASS}>
                            {index === 0 ? (
                              <Link href={page.pageHref}>{page.pageTitle}</Link>
                            ) : (
                              ""
                            )}
                          </td>
                          <td className={TD_CLASS}>{BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType}</td>
                          <td className={TD_CLASS}>{block.structured ? "bereinigt" : "—"}</td>
                          <td className={TD_CLASS}>
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
              </div>
            )}

            {preview.typeChanges.length > 0 && (
              <>
                <h3 className="text-sm font-semibold">Seitentyp-Änderungen</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={TH_CLASS}>Seite</th>
                        <th className={TH_CLASS}>Bisher</th>
                        <th className={TH_CLASS}>Neu (aus Inhalt)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.typeChanges.map((change) => (
                        <tr key={change.pageId}>
                          <td className={TD_CLASS}>
                            <Link href={change.pageHref}>{change.pageTitle}</Link>
                          </td>
                          <td className={TD_CLASS}>{typeLabel(change.fromType)}</td>
                          <td className={TD_CLASS}>
                            <strong>{typeLabel(change.toType)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <Button type="button" disabled={loading} onClick={handleApply} className="self-start">
              {loading
                ? "Konvertiert…"
                : `Konvertierung anwenden (${preview.changedBlockCount + preview.typeChangeCount})`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
