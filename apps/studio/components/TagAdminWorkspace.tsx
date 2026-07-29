"use client";

import { studioApiFetch } from "@/src/lib/studio-api-fetch";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LoadingState,
} from "@/src/components/ui";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

interface TagReference {
  entityType: string;
  entityId: string;
  title: string;
}

interface TagInventoryEntry {
  tag: string;
  normalizedKey: string;
  count: number;
  references: TagReference[];
  onlyOnDrafts: boolean;
  onlyDmOnly: boolean;
}

interface TagMergeSuggestion {
  targetTag: string;
  sourceTags: string[];
  totalReferences: number;
  reason: string;
}

interface SimilarTagGroup {
  canonical: string;
  variants: string[];
  reason: string;
}

interface TagsResponse {
  inventory: TagInventoryEntry[];
  suggestions: TagMergeSuggestion[];
  unused: TagInventoryEntry[];
  similar: SimilarTagGroup[];
  coverage?: {
    types: Array<{
      entityType: string;
      totalEntities: number;
      jsonTagged: number;
      entityTagTagged: number;
    }>;
    totalTags: number;
    totalEntityTags: number;
  };
  entityTypeLabels?: Record<string, string>;
}

/**
 * Tag-Aufräumer einer Welt.
 *
 * Lag früher unter `/admin/tags` mit einem „Alle Welten"-Filter. Tags sind
 * Inhaltsverschlagwortung, keine Systemkonfiguration — die Fläche gehört
 * deshalb ins Welt-Cockpit (Notiz Lasse, D30). Die Welt kommt von der Route,
 * nicht aus einem Dropdown.
 */
export function TagAdminWorkspace({ worldId }: { worldId: string }) {
  const [data, setData] = useState<TagsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergeToTag, setMergeToTag] = useState("");
  const [mergeFromTags, setMergeFromTags] = useState("");
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ worldId });

    try {
      const response = await studioApiFetch(`/api/tags?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Tags konnten nicht geladen werden (${response.status}).`);
      }
      setData((await response.json()) as TagsResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [worldId]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  async function handleMerge(event: React.FormEvent) {
    event.preventDefault();
    setMerging(true);
    setMergeStatus(null);

    try {
      const response = await studioApiFetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          worldId,
          fromTags: mergeFromTags,
          toTag: mergeToTag,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? `Merge fehlgeschlagen (${response.status}).`);
      }

      const payload = (await response.json()) as {
        result: { updatedEntities: number; toTag: string };
      };
      setMergeStatus(
        `Zusammengeführt nach „${payload.result.toTag}" — ${payload.result.updatedEntities} Entitäten aktualisiert.`,
      );
      setMergeFromTags("");
      setMergeToTag("");
      await loadTags();
    } catch (mergeError) {
      setMergeStatus(
        mergeError instanceof Error ? mergeError.message : "Merge fehlgeschlagen.",
      );
    } finally {
      setMerging(false);
    }
  }

  function applySuggestion(suggestion: TagMergeSuggestion) {
    setMergeToTag(suggestion.targetTag);
    setMergeFromTags(suggestion.sourceTags.join(", "));
  }

  async function handleBackfill() {
    setBackfilling(true);
    setBackfillStatus(null);

    try {
      const response = await studioApiFetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "backfill",
          worldId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? `Backfill fehlgeschlagen (${response.status}).`);
      }

      const payload = (await response.json()) as {
        result: { entitiesProcessed: number; entityTagsCreated: number };
      };
      setBackfillStatus(
        `Backfill abgeschlossen — ${payload.result.entitiesProcessed} Entitäten, ${payload.result.entityTagsCreated} neue EntityTag-Zeilen.`,
      );
      await loadTags();
    } catch (backfillError) {
      setBackfillStatus(
        backfillError instanceof Error ? backfillError.message : "Backfill fehlgeschlagen.",
      );
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <>
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Button type="button" variant="secondary" onClick={() => void loadTags()}>
            Aktualisieren
          </Button>
        </CardContent>
      </Card>

      {loading && <LoadingState title="Lade Tag-Inventar…" />}
      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}

      {data && !loading && (
        <div className="flex flex-col gap-6">
          {data.coverage && (
            <Card>
              <CardHeader>
                <CardTitle>EntityTag-Abdeckung</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {data.coverage.totalTags} zentrale Tags · {data.coverage.totalEntityTags}{" "}
                  EntityTag-Verknüpfungen. Inventar und Merge nutzen EntityTag als Primärquelle;
                  Legacy-Json nur für noch nicht backgefillte Entitäten.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.coverage.types.map((entry) => (
                    <Card key={entry.entityType} className="p-3.5">
                      <h3 className="text-sm font-medium">
                        {data.entityTypeLabels?.[entry.entityType] ?? entry.entityType}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Quelle: {entry.jsonTagged}/{entry.totalEntities} · EntityTag:{" "}
                        {entry.entityTagTagged}/{entry.totalEntities}
                      </p>
                    </Card>
                  ))}
                </div>
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={backfilling}
                    onClick={() => void handleBackfill()}
                  >
                    {backfilling ? "Backfill läuft…" : "Legacy-Tags → EntityTag backfillen"}
                  </Button>
                </div>
                {backfillStatus && <p className="text-sm text-muted-foreground">{backfillStatus}</p>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Merge-Vorschläge ({data.suggestions.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine ähnlichen Tags gefunden.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.suggestions.slice(0, 20).map((suggestion) => (
                    <Card
                      key={`${suggestion.targetTag}-${suggestion.sourceTags.join("-")}`}
                      className="p-3.5"
                    >
                      <h3 className="text-sm font-medium">
                        {suggestion.sourceTags.join(", ")} → {suggestion.targetTag}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {suggestion.reason} · {suggestion.totalReferences} Referenzen
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={() => applySuggestion(suggestion)}
                      >
                        In Merge-Formular übernehmen
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tags zusammenführen</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleMerge}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tag-admin-merge-to">Ziel-Tag</Label>
                  <Input
                    id="tag-admin-merge-to"
                    value={mergeToTag}
                    onChange={(event) => setMergeToTag(event.target.value)}
                    placeholder="stadt"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tag-admin-merge-from">Quell-Tags (kommagetrennt)</Label>
                  <Input
                    id="tag-admin-merge-from"
                    value={mergeFromTags}
                    onChange={(event) => setMergeFromTags(event.target.value)}
                    placeholder="Stadt, STADT"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={merging}>
                    {merging ? "Merge läuft…" : "Tags mergen"}
                  </Button>
                </div>
              </form>
              {mergeStatus && <p className="mt-3 text-sm text-muted-foreground">{mergeStatus}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Unbenutzte Kandidaten ({data.unused.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Tags nur auf Drafts oder nur dm_only — Kandidaten zum Aufräumen.
              </p>
              {data.unused.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {data.unused.slice(0, 30).map((entry) => (
                    <li key={entry.tag}>
                      <strong>{entry.tag}</strong> ({entry.count}×)
                      {entry.onlyOnDrafts && " · nur Drafts"}
                      {entry.onlyDmOnly && " · nur dm_only"}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Ohne Referenzen ({data.inventory.filter((entry) => entry.count === 0).length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Tags im Inventar ohne EntityTag-Verknüpfungen — Kandidaten zum Entfernen nach manuellem
                Review.
              </p>
              {data.inventory.filter((entry) => entry.count === 0).length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {data.inventory
                    .filter((entry) => entry.count === 0)
                    .slice(0, 30)
                    .map((entry) => (
                      <li key={`orphan-${entry.tag}`}>
                        <strong>{entry.tag}</strong>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tag-Inventar ({data.inventory.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Tag</th>
                    <th className={TH_CLASS}>Normalisiert</th>
                    <th className={TH_CLASS}>Referenzen</th>
                    <th className={TH_CLASS}>Hinweise</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventory.slice(0, 100).map((entry) => (
                    <tr key={entry.tag}>
                      <td className={TD_CLASS}>
                        <strong>{entry.tag}</strong>
                      </td>
                      <td className={TD_CLASS}>{entry.normalizedKey}</td>
                      <td className={TD_CLASS}>{entry.count}</td>
                      <td className={TD_CLASS}>
                        {entry.onlyOnDrafts && <Badge variant="warning">Draft</Badge>}{" "}
                        {entry.onlyDmOnly && <Badge variant="secondary">dm_only</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
