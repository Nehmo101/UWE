"use client";

import { useCallback, useRef, useState } from "react";
import type { ReaderPageView } from "@/src/lib/page-reader";

/**
 * Lädt Leseansichten für den Session-Runner nach.
 *
 * Ein `AbortController` je Hook-Instanz: wer schnell durch ein Kapitel blättert,
 * löst mehrere Anfragen aus, und ohne Abbruch könnte die langsamere die
 * schnellere überschreiben. Ein kleiner Zwischenspeicher hält bereits gelesene
 * Seiten, damit Zurück/Vor am Spieltisch sofort reagiert.
 */
export function usePageReader(worldSlug: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<string, ReaderPageView>());
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(
    async (pageSlug: string): Promise<ReaderPageView | null> => {
      const cached = cache.current.get(pageSlug);
      if (cached) {
        setError(null);
        return cached;
      }

      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/worlds/${encodeURIComponent(worldSlug)}/reader/${encodeURIComponent(pageSlug)}`,
          { signal: controller.signal },
        );

        if (response.status === 404) {
          setError("Diese Seite gibt es (noch) nicht.");
          return null;
        }
        if (!response.ok) {
          setError("Seite konnte nicht geladen werden.");
          return null;
        }

        const view = (await response.json()) as ReaderPageView;
        cache.current.set(pageSlug, view);
        return view;
      } catch (caught) {
        // Ein Abbruch ist kein Fehler — da tippt jemand schneller als das Netz.
        if (caught instanceof DOMException && caught.name === "AbortError") return null;
        setError("Seite konnte nicht geladen werden.");
        return null;
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setLoading(false);
        }
      }
    },
    [worldSlug],
  );

  const forget = useCallback((pageSlug: string) => {
    cache.current.delete(pageSlug);
  }, []);

  return { load, forget, loading, error, setError };
}

/** Aus `/worlds/terra/npcs/pellar-hopsenried` wird `pellar-hopsenried`. */
export function pageSlugFromHref(href: string): string | null {
  const path = href.split("?")[0]?.split("#")[0] ?? "";
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 4 || segments[0] !== "worlds") return null;
  return segments[segments.length - 1] ?? null;
}
