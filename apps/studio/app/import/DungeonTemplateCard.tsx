"use client";

import { useCallback, useState } from "react";
import {
  DUNGEON_CONVERSION_TEMPLATE,
  DUNGEON_TEMPLATE_FILE_NAME,
} from "@uwe/doc-import";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui";

/**
 * Das Konvertierungstemplate zum Dungeon-Profil.
 *
 * Wer fremdes Material (PDF, KI-Ausgabe, Notizen) importieren will, braucht die
 * Form, die die Import-Regeln verstehen: Ebenen, Räume und darunter Begegnung/
 * Falle/Rätsel/Beute/Geheimnis als eigene Überschriften. Diese Karte gibt die
 * Vorlage zum Kopieren und Herunterladen heraus — als Konvertierungsauftrag an
 * eine KI oder als Gerüst zum Selberfüllen.
 */
export function DungeonTemplateCard() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(DUNGEON_CONVERSION_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, []);

  const handleDownload = useCallback(() => {
    const blob = new Blob([DUNGEON_CONVERSION_TEMPLATE], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = DUNGEON_TEMPLATE_FILE_NAME;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Konvertierungstemplate: Dungeon</CardTitle>
        <CardDescription>
          Die Form, die der Import garantiert versteht: Ebenen, Räume und darunter
          Begegnung, Falle, Rätsel, Beute und Geheimnis als eigene Überschriften — dazu
          Werteblöcke und Handouts. Material in diese Vorlage umschreiben (oder von einer
          KI umschreiben lassen), dann hier mit Profil „Dungeon“ importieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleCopy}>
            {copied ? "Kopiert ✓" : "Vorlage kopieren"}
          </Button>
          <Button type="button" variant="outline" onClick={handleDownload}>
            Als {DUNGEON_TEMPLATE_FILE_NAME} herunterladen
          </Button>
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Vorlage ansehen
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-[var(--radius)] border border-border bg-muted/40 p-3 text-xs leading-relaxed">
            <code>{DUNGEON_CONVERSION_TEMPLATE}</code>
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}
