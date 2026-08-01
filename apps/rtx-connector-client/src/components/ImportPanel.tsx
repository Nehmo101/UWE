import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { opsInvoke } from "../lib/tauri";

/**
 * Dokument- und Bulk-Wiki-Import direkt auf dem Host.
 *
 * Dieselbe Maschinerie wie die Import-Zentrale im Studio, nur ohne Upload: das
 * Command Center läuft auf derselben Maschine wie die Dateien, also genügt ein
 * **Pfad**. Für 200 Vault-Dateien ist das der eigentliche Unterschied — im
 * Browser müssten sie erst durch einen Datei-Dialog.
 *
 * Zwei Betriebsarten, wie im Studio:
 *   • Wiki-Seiten  — eine Datei wird eine Seite.
 *   • Dokument     — eine Datei wird ein Seitenbaum in Lesereihenfolge.
 */

type Mode = "wiki_pages" | "document";
type Profile = "campaign_book" | "dungeon" | "canon" | "plain";

const MODE_LABELS: Record<Mode, string> = {
  wiki_pages: "Wiki-Seiten",
  document: "Dokument / Buch",
};

const MODE_HINTS: Record<Mode, string> = {
  wiki_pages: "Eine Datei wird eine Seite — auch bei vielen Überschriften. Für Vault-Ordner.",
  document: "Eine Datei wird ein Seitenbaum. Für Kampagnenbücher, Dungeons, Weltkanon.",
};

const PROFILE_LABELS: Record<Profile, string> = {
  campaign_book: "Kampagnenbuch",
  dungeon: "Dungeon",
  canon: "Weltkanon",
  plain: "Einfach",
};

interface ImportWorld {
  slug: string;
  name: string;
  pageCount: number;
}

interface PreviewSample {
  title: string;
  slug: string;
  type: string;
  depth: number;
  status: string;
}

interface PreviewResult {
  worldSlug: string;
  fileCount: number;
  pageCount: number;
  perFile: Array<{ fileName: string; pageCount: number }>;
  summary: { new: number; conflict: number; duplicate: number };
  warnings: string[];
  unresolvedLinks: string[];
  sample: PreviewSample[];
}

interface ExecuteResult {
  created: number;
  failed: number;
  linksCreated: number;
  warnings: string[];
}

function toMessage(error: unknown): string {
  if (typeof error === "string") return error.trim() || "Unbekannter Fehler";
  if (error instanceof Error) return error.message.trim() || "Unbekannter Fehler";
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return "Unbekannter Fehler";
}

const FIELD_CLASS =
  "w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground";

export function ImportPanel() {
  const [worlds, setWorlds] = useState<ImportWorld[]>([]);
  const [worldSlug, setWorldSlug] = useState("");
  const [sourcePath, setSourcePath] = useState("");
  const [mode, setMode] = useState<Mode>("wiki_pages");
  const [profile, setProfile] = useState<Profile>("plain");
  const [maxDepth, setMaxDepth] = useState(3);

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorlds = useCallback(async () => {
    setError(null);
    try {
      const response = await opsInvoke<{ worlds: ImportWorld[] }>("doc-import-targets");
      if (!response.ok) throw new Error(response.message ?? "Welten konnten nicht geladen werden.");

      const list = response.data?.worlds ?? [];
      setWorlds(list);
      setWorldSlug((current) => current || (list[0]?.slug ?? ""));
    } catch (nextError) {
      setError(toMessage(nextError));
    }
  }, []);

  useEffect(() => {
    const loadOnMount = () => {
      void loadWorlds();
    };

    loadOnMount();
  }, [loadWorlds]);

  const request = useMemo(
    () => ({ path: sourcePath.trim(), worldSlug, mode, profile, maxDepth }),
    [maxDepth, mode, profile, sourcePath, worldSlug],
  );

  const resetOutcome = useCallback(() => {
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!request.path) {
      setError("Bitte einen Pfad zu einer Datei oder einem Ordner angeben.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const response = await opsInvoke<PreviewResult>("doc-import-preview", request);
      if (!response.ok || !response.data) {
        throw new Error(response.message ?? "Vorschau fehlgeschlagen.");
      }
      setPreview(response.data);
    } catch (nextError) {
      setError(toMessage(nextError));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }, [request]);

  const handleExecute = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const response = await opsInvoke<ExecuteResult>("doc-import-execute", request);
      if (!response.ok || !response.data) {
        throw new Error(response.message ?? "Import fehlgeschlagen.");
      }
      setResult(response.data);
      setPreview(null);
      void loadWorlds();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }, [loadWorlds, request]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Inhalte importieren</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Markdown von diesem Rechner nach UWE. Kein Upload — der Pfad genügt, die Dateien
            liegen ja schon hier.
          </p>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Pfad zu Datei oder Ordner</span>
            <input
              className={FIELD_CLASS}
              value={sourcePath}
              placeholder="C:\\UWE\\Kampagnen\\Himmelsrouten.md"
              onChange={(event) => {
                setSourcePath(event.target.value);
                resetOutcome();
              }}
            />
            <span className="text-xs text-muted-foreground">
              Ordner werden mit Unterordnern gelesen (.md, .markdown, .txt). Versteckte Ordner
              wie <code>.obsidian</code> bleiben außen vor.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Zielwelt</span>
            <select
              className={FIELD_CLASS}
              value={worldSlug}
              onChange={(event) => {
                setWorldSlug(event.target.value);
                resetOutcome();
              }}
            >
              {worlds.length === 0 ? <option value="">Keine Welt gefunden</option> : null}
              {worlds.map((world) => (
                <option key={world.slug} value={world.slug}>
                  {world.name} ({world.pageCount} Seiten)
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Wie soll das ankommen?</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MODE_LABELS) as Mode[]).map((value) => (
                <Button
                  key={value}
                  variant={mode === value ? "default" : "outline"}
                  onClick={() => {
                    setMode(value);
                    resetOutcome();
                  }}
                >
                  {MODE_LABELS[value]}
                </Button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{MODE_HINTS[mode]}</span>
          </div>

          {mode === "document" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Typ-Profil</span>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(PROFILE_LABELS) as Profile[]).map((value) => (
                    <Button
                      key={value}
                      variant={profile === value ? "default" : "outline"}
                      onClick={() => {
                        setProfile(value);
                        resetOutcome();
                      }}
                    >
                      {PROFILE_LABELS[value]}
                    </Button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Bis Überschriftenebene {maxDepth} aufteilen</span>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={maxDepth}
                  onChange={(event) => {
                    setMaxDepth(Number.parseInt(event.target.value, 10));
                    resetOutcome();
                  }}
                />
              </label>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={handlePreview} disabled={busy || !worldSlug}>
            {busy && !preview ? "Wird gelesen…" : "Vorschau"}
          </Button>
          {preview ? (
            <Button onClick={handleExecute} disabled={busy}>
              {preview.pageCount} Seite(n) anlegen
            </Button>
          ) : null}
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
        </CardFooter>
      </Card>

      {preview ? <PreviewCard preview={preview} /> : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Fertig</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              {result.created} Seite(n) angelegt, {result.linksCreated} Beziehung(en) verknüpft
              {result.failed > 0 ? `, ${result.failed} fehlgeschlagen` : ""}.
            </p>
            {result.warnings.map((warning) => (
              <p key={warning} className="text-muted-foreground">
                {warning}
              </p>
            ))}
            <p className="text-muted-foreground">
              Rückgängig machen geht im Studio über das Aktivitätsprotokoll.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PreviewCard({ preview }: { preview: PreviewResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Vorschau — {preview.pageCount} Seite(n) aus {preview.fileCount} Datei(en)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          {preview.summary.new} neu · {preview.summary.conflict} mit vergebenem Slug ·{" "}
          {preview.summary.duplicate} mit vorhandenem Titel
        </p>

        {preview.warnings.map((warning) => (
          <p key={warning} className="text-muted-foreground">
            {warning}
          </p>
        ))}

        {preview.unresolvedLinks.length > 0 ? (
          <p className="text-muted-foreground">
            {preview.unresolvedLinks.length} Verweis(e) zeigen auf Seiten, die es noch nicht gibt —
            sie heilen, sobald die Ziele entstehen.
          </p>
        ) : null}

        <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
          {preview.sample.map((item) => (
            <li
              key={`${item.slug}-${item.title}`}
              style={{ paddingInlineStart: `${item.depth * 1.1}rem` }}
              className="truncate"
            >
              {item.title}{" "}
              <span className="text-xs text-muted-foreground">
                ·{item.type}· /{item.slug}
                {item.status !== "new" ? ` · ${item.status}` : ""}
              </span>
            </li>
          ))}
        </ul>

        {preview.pageCount > preview.sample.length ? (
          <p className="text-xs text-muted-foreground">
            … und {preview.pageCount - preview.sample.length} weitere.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
