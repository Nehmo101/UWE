"use client";

import { useEffect, useState } from "react";
import type { DndApiSearchResult } from "@uwe/dnd-api";

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const CACHE_PREFIX = "uwe_dnd_api_cache_";

interface CachedSearchPayload {
  savedAt: number;
  results: DndApiSearchResult[];
}

function cacheKey(query: string): string {
  return `${CACHE_PREFIX}${query.trim().toLowerCase()}`;
}

function readCache(query: string): DndApiSearchResult[] | null {
  if (typeof window === "undefined" || !query.trim()) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(query));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSearchPayload;
    if (!parsed.savedAt || !Array.isArray(parsed.results)) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(cacheKey(query));
      return null;
    }
    return parsed.results;
  } catch {
    return null;
  }
}

function writeCache(query: string, results: DndApiSearchResult[]): void {
  if (typeof window === "undefined" || !query.trim()) return;
  const payload: CachedSearchPayload = { savedAt: Date.now(), results };
  window.localStorage.setItem(cacheKey(query), JSON.stringify(payload));
}

interface DndApiBrowseCacheNoticeProps {
  query: string;
  results: DndApiSearchResult[];
}

/** Persists browse/search results locally and shows cache status (#685). */
export function DndApiBrowseCacheNotice({ query, results }: DndApiBrowseCacheNoticeProps) {
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setFromCache(false);
      return;
    }
    const cached = readCache(query);
    if (cached && cached.length > 0 && results.length === 0) {
      setFromCache(true);
      return;
    }
    if (results.length > 0) {
      writeCache(query, results);
      setFromCache(false);
    }
  }, [query, results]);

  if (!query.trim()) {
    return (
      <p className="uwe-hint" style={{ marginTop: "0.5rem" }}>
        Suchergebnisse werden lokal zwischengespeichert (24 h) — wiederholte Suchen laden schneller.
      </p>
    );
  }

  return (
    <p className="uwe-hint" style={{ marginTop: "0.5rem" }}>
      {fromCache
        ? "Keine frischen API-Treffer — zuletzt zwischengespeicherte Ergebnisse werden angezeigt."
        : `${results.length} Treffer — lokal zwischengespeichert für schnellere Wiederholung.`}
    </p>
  );
}

export function getCachedDndApiResults(query: string): DndApiSearchResult[] | null {
  return readCache(query);
}

export function primeDndApiResultsCache(query: string, results: DndApiSearchResult[]): void {
  writeCache(query, results);
}
