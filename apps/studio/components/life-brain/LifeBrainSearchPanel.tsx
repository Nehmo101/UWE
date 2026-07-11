"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PERSONAL_BRAIN_CATEGORIES,
  PERSONAL_BRAIN_CATEGORY_LABELS,
} from "@uwe/database/personal-brain-constants";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/src/components/ui";

interface SearchDocumentHit {
  id: string;
  title: string;
  content: string;
  category: string | null;
  score: number;
  matchMode?: string;
}

interface SearchFactHit {
  id: string;
  title: string;
  content: string;
  factType: string;
  score: number;
  matchMode?: string;
}

interface SearchChunkHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  category: string | null;
  content: string;
  score: number;
}

interface SearchResponse {
  matchMode?: "semantic" | "keyword" | "filter";
  documents: SearchDocumentHit[];
  facts: SearchFactHit[];
  chunks?: SearchChunkHit[];
}

function truncate(text: string, maxLength = 140): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** Native select styling — siehe TODO(design-kit) bei der ersten Verwendung unten. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function LifeBrainSearchPanel() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResponse | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 && !category) {
      setResults(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (trimmed.length >= 2) {
          params.set("q", trimmed);
        }
        if (category) {
          params.set("category", category);
        }
        params.set("limit", "20");

        const response = await fetch(`/api/life-brain/search?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Suche fehlgeschlagen (${response.status})`);
        }

        const payload = (await response.json()) as SearchResponse;
        setResults(payload);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Suche fehlgeschlagen");
        setResults(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, category]);

  const chunkCount = results?.chunks?.length ?? 0;
  const hasHits =
    results != null &&
    (results.documents.length > 0 || results.facts.length > 0 || chunkCount > 0);
  const showEmpty =
    results != null &&
    !loading &&
    query.trim().length >= 2 &&
    results.documents.length === 0 &&
    results.facts.length === 0 &&
    chunkCount === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suche</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="life-brain-search-query">Stichwort</Label>
            <Input
              id="life-brain-search-query"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="homelab, netzwerk, filament…"
              autoComplete="off"
            />
          </div>
          {/* TODO(design-kit): Controlled Select mit Leerwert-Option ("Alle Kategorien") —
              Kit-Select (Radix) unterstützt das nicht; native <select> bleibt. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="life-brain-search-category">Kategorie</Label>
            <select
              id="life-brain-search-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={NATIVE_SELECT_CLASS}
            >
              <option value="">Alle Kategorien</option>
              {PERSONAL_BRAIN_CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>
                  {PERSONAL_BRAIN_CATEGORY_LABELS[entry]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Suche läuft…</p>}
        {results?.matchMode && query.trim().length >= 2 && (
          <p className="text-sm text-muted-foreground">
            Modus:{" "}
            {results.matchMode === "semantic"
              ? "Semantisch (RTX/Embeddings)"
              : results.matchMode === "keyword"
                ? "Stichwort-Fallback"
                : "Filter"}
          </p>
        )}
        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}
        {showEmpty && (
          <p className="text-sm text-muted-foreground">Keine Treffer für „{query.trim()}“.</p>
        )}

        {hasHits && (
          <div className="flex flex-col gap-6">
            {chunkCount > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Chunks ({chunkCount})</h3>
                <div className="grid gap-2">
                  {results.chunks!.map((chunk) => (
                    <Card key={chunk.chunkId}>
                      <CardContent className="flex flex-col gap-1 pt-6">
                        <h4 className="font-medium">
                          <Link href={`/life-brain/documents/${chunk.documentId}`}>
                            {chunk.documentTitle}
                          </Link>{" "}
                          <Badge>{formatScore(chunk.score)}</Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {chunk.category
                            ? (PERSONAL_BRAIN_CATEGORY_LABELS[
                                chunk.category as (typeof PERSONAL_BRAIN_CATEGORIES)[number]
                              ] ?? chunk.category)
                            : "Allgemein"}
                        </p>
                        {chunk.content && <p className="text-sm">{truncate(chunk.content)}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {results.documents.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Dokumente ({results.documents.length})</h3>
                <div className="grid gap-2">
                  {results.documents.map((document) => (
                    <Card key={document.id}>
                      <CardContent className="flex flex-col gap-1 pt-6">
                        <h4 className="font-medium">
                          <Link href={`/life-brain/documents/${document.id}`}>{document.title}</Link>{" "}
                          {document.score > 0 ? <Badge>{formatScore(document.score)}</Badge> : null}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {document.category
                            ? (PERSONAL_BRAIN_CATEGORY_LABELS[
                                document.category as (typeof PERSONAL_BRAIN_CATEGORIES)[number]
                              ] ?? document.category)
                            : "Allgemein"}
                        </p>
                        {document.content && <p className="text-sm">{truncate(document.content)}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {results.facts.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Fakten ({results.facts.length})</h3>
                <div className="grid gap-2">
                  {results.facts.map((fact) => (
                    <Card key={fact.id}>
                      <CardContent className="flex flex-col gap-1 pt-6">
                        <h4 className="font-medium">
                          <Link href={`/life-brain/facts/${fact.id}`}>{fact.title}</Link>{" "}
                          {fact.score > 0 ? <Badge>{formatScore(fact.score)}</Badge> : null}
                        </h4>
                        <p className="text-sm text-muted-foreground">{fact.factType}</p>
                        {fact.content && <p className="text-sm">{truncate(fact.content)}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {query.trim().length === 1 && (
          <p className="text-sm text-muted-foreground">Mindestens 2 Zeichen für die Stichwortsuche.</p>
        )}
      </CardContent>
    </Card>
  );
}
