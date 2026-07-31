"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  PAGE_TYPE_LABELS,
  ResponsiveTable,
} from "@uwe/shared-ui";
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
              /* Der Seitentitel stand bisher nur in der ersten Blockzeile;
                 die folgenden Zeilen hatten eine leere Zelle. Als Karte auf dem
                 Telefon wäre das eine Karte ohne Überschrift — deshalb trägt
                 jede Zeile jetzt ihre Seite. */
              <ResponsiveTable
                caption="Geänderte Blöcke"
                rowKey={(row) => row.block.blockId}
                rows={preview.pages.flatMap((page) =>
                  page.blocks.map((block) => ({ page, block })),
                )}
                columns={[
                  {
                    key: "page",
                    label: "Seite",
                    primary: true,
                    render: ({ page }) => <Link href={page.pageHref}>{page.pageTitle}</Link>,
                  },
                  {
                    key: "block",
                    label: "Block",
                    render: ({ block }) => BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType,
                  },
                  {
                    key: "structure",
                    label: "Struktur",
                    render: ({ block }) => (block.structured ? "bereinigt" : "—"),
                  },
                  {
                    key: "links",
                    label: "Neue Verbindungen",
                    render: ({ block }) =>
                      block.addedLinks.length > 0
                        ? block.addedLinks
                            .map((link) =>
                              link.matched === link.target
                                ? `[[${link.target}]]`
                                : `[[${link.target}|${link.matched}]]`,
                            )
                            .join(", ")
                        : "—",
                  },
                ]}
              />
            )}

            {preview.typeChanges.length > 0 && (
              <>
                <h3 className="text-sm font-semibold">Seitentyp-Änderungen</h3>
                <ResponsiveTable
                  caption="Seitentyp-Änderungen"
                  rowKey={(change) => change.pageId}
                  rows={preview.typeChanges}
                  columns={[
                    {
                      key: "page",
                      label: "Seite",
                      primary: true,
                      render: (change) => <Link href={change.pageHref}>{change.pageTitle}</Link>,
                    },
                    { key: "from", label: "Bisher", render: (change) => typeLabel(change.fromType) },
                    {
                      key: "to",
                      label: "Neu (aus Inhalt)",
                      render: (change) => <strong>{typeLabel(change.toType)}</strong>,
                    },
                  ]}
                />
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
