"use client";

import Link from "next/link";
import { studioApiFetch } from "@/src/lib/studio-api-fetch";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDateTime } from "@/src/lib/format";
import { Alert, Badge, Button, buttonVariants, Card, CardContent, CardHeader, CardTitle, Label } from "@/src/components/ui";

interface UnifiedEntry {
  id: string;
  source: "activity" | "audit" | "ai_usage";
  timestamp: string;
  action: string;
  actionLabel: string;
  summary: string;
  worldId: string | null;
  worldSlug: string | null;
  actorUserId: string | null;
  actorDisplayName: string | null;
  targetHref: string | null;
  severity: "info" | "warn" | "error";
}

interface WorldOption {
  id: string;
  name: string;
  slug: string;
}

const SOURCE_LABELS: Record<UnifiedEntry["source"], string> = {
  activity: "Aktivität",
  audit: "Audit",
  ai_usage: "KI-Nutzung",
};

const PAGE_SIZE = 25;

/** TODO(design-kit): Native select bleibt — controlled Filter mit Leerwert ("Alle"/"Gesamt"),
    siehe gleiches Muster in JobsWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function severityBadgeVariant(severity: UnifiedEntry["severity"]): "danger" | "warning" | "info" {
  if (severity === "error") return "danger";
  if (severity === "warn") return "warning";
  return "info";
}

export function UnifiedActivityWorkspace() {
  const [entries, setEntries] = useState<UnifiedEntry[]>([]);
  const [worlds, setWorlds] = useState<WorldOption[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [worldSlug, setWorldSlug] = useState("");
  const [severity, setSeverity] = useState("");
  const [sinceDays, setSinceDays] = useState("30");

  useEffect(() => {
    setOffset(0);
  }, [source, worldSlug, severity, sinceDays]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (worldSlug) params.set("worldSlug", worldSlug);
    if (severity) params.set("severity", severity);
    if (sinceDays) params.set("sinceDays", sinceDays);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    try {
      const response = await studioApiFetch(`/api/admin/activity?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Verlauf konnte nicht geladen werden (${response.status}).`);
      }
      const data = (await response.json()) as {
        entries: UnifiedEntry[];
        total: number;
        worlds: WorldOption[];
      };
      setEntries(data.entries);
      setTotal(data.total);
      setWorlds(data.worlds);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [source, worldSlug, severity, sinceDays, offset]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="activity-filter-source">Quelle</Label>
              <select
                id="activity-filter-source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="">Alle Quellen</option>
                <option value="activity">Aktivität</option>
                <option value="audit">Audit</option>
                <option value="ai_usage">KI-Nutzung</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="activity-filter-world">Welt</Label>
              <select
                id="activity-filter-world"
                value={worldSlug}
                onChange={(event) => setWorldSlug(event.target.value)}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="">Alle Welten</option>
                {worlds.map((world) => (
                  <option key={world.id} value={world.slug}>
                    {world.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="activity-filter-severity">Schweregrad</Label>
              <select
                id="activity-filter-severity"
                value={severity}
                onChange={(event) => setSeverity(event.target.value)}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="">Alle</option>
                <option value="info">Info</option>
                <option value="warn">Warnung</option>
                <option value="error">Fehler</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="activity-filter-since-days">Zeitraum</Label>
              <select
                id="activity-filter-since-days"
                value={sinceDays}
                onChange={(event) => setSinceDays(event.target.value)}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="7">Letzte 7 Tage</option>
                <option value="30">Letzte 30 Tage</option>
                <option value="90">Letzte 90 Tage</option>
                <option value="">Gesamt</option>
              </select>
            </div>
            <div className="self-end">
              <Button type="button" variant="secondary" onClick={() => void loadEntries()}>
                Aktualisieren
              </Button>
            </div>
          </div>
          {worldSlug && source === "ai_usage" && (
            <p className="text-sm text-muted-foreground">
              KI-Nutzung ist global — Weltfilter blendet nur Aktivität/Audit ein.
            </p>
          )}
        </CardContent>
      </Card>

      {loading && <p>Lade Verlauf…</p>}
      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>
              Einträge ({entries.length} von {total})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Einträge gefunden.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {entries.map((entry) => (
                  <article
                    key={entry.id}
                    className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4 text-sm text-card-foreground shadow-sm"
                  >
                    <header className="flex flex-wrap items-center gap-2">
                      <Badge variant={severityBadgeVariant(entry.severity)}>{SOURCE_LABELS[entry.source]}</Badge>
                      <strong>{entry.actionLabel}</strong>
                      <span className="text-sm text-muted-foreground">{formatStudioDateTime(entry.timestamp)}</span>
                    </header>
                    <p>{entry.summary}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.worldSlug ? `Welt: ${entry.worldSlug}` : "Global"}
                      {entry.actorDisplayName
                        ? ` · ${entry.actorDisplayName}`
                        : entry.actorUserId
                          ? ` · User ${entry.actorUserId}`
                          : ""}
                    </p>
                    {entry.targetHref && (
                      <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={entry.targetHref}>
                        Ziel öffnen
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            )}
            {total > PAGE_SIZE ? (
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Seite {page} von {pageCount}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
                  >
                    Zurück
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={offset + PAGE_SIZE >= total}
                    onClick={() => setOffset((value) => value + PAGE_SIZE)}
                  >
                    Weiter
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </>
  );
}
