"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReaderPageView } from "@/src/lib/page-reader";
import { usePageReader } from "@/src/lib/use-page-reader";
import { useCompactViewport } from "@/src/lib/use-compact-viewport";
import { saveSessionBookmarkAction } from "@/app/session-live-actions";
import { Button, Sheet, SheetContent } from "@/src/components/ui";
import { ReadingPane } from "./ReadingPane";
import { ContextPane } from "./ContextPane";

export interface RunnerJumpTarget {
  id: string;
  title: string;
  slug: string;
  type: string;
}

interface Props {
  worldSlug: string;
  sessionId: string;
  /** Die mit der Session verknüpften Seiten — die Sprungmarken des Abends. */
  jumpTargets: RunnerJumpTarget[];
  /** Wo zuletzt gelesen wurde (aus dem jüngsten Lesezeichen). */
  initialPageSlug: string | null;
  initialAnchor: string | null;
}

const SPLIT_STORAGE_PREFIX = "uwe:runner-split:";
const MIN_SPLIT = 25;
const MAX_SPLIT = 75;

/**
 * Der Session-Runner: links der Kapiteltext, rechts der Eintrag, den man
 * gerade nachschlägt.
 *
 * Der Punkt der ganzen Übung ist, dass ein Klick auf `[[Xarza]]` **nicht**
 * navigiert. Das linke Pane behält seine Scrollposition, das rechte zeigt den
 * Eintrag. Ohne das ist ein Wiki am Spieltisch eine Zumutung: jeder
 * Nachschlagevorgang kostet die Stelle, an der man vorgelesen hat.
 *
 * Unter `lg` gibt es keinen Platz für zwei Spalten — dort wird das rechte Pane
 * zu einer Schublade über dem Text.
 */
export function SessionRunner({
  worldSlug,
  sessionId,
  jumpTargets,
  initialPageSlug,
  initialAnchor,
}: Props) {
  const reader = usePageReader(worldSlug);
  const compact = useCompactViewport();

  const [reading, setReading] = useState<ReaderPageView | null>(null);
  const [readingAnchor, setReadingAnchor] = useState<string | null>(initialAnchor);
  const [context, setContext] = useState<ReaderPageView | null>(null);
  const [contextHistory, setContextHistory] = useState<ReaderPageView[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [split, setSplit] = useState(55);
  const [contextLoading, setContextLoading] = useState(false);
  // Eigener Fehlerzustand je Pane — sonst zeigt das rechte den Fehler des linken.
  const [contextError, setContextError] = useState<string | null>(null);

  const scrollRatio = useRef(0);
  const dragging = useRef(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const storageKey = `${SPLIT_STORAGE_PREFIX}${sessionId}`;

  // Erst nach dem Rendern lesen: der Server kennt kein `localStorage`, und ein
  // abweichender Startwert wäre eine Hydrations-Abweichung.
  useEffect(() => {
    const applyStoredSplit = () => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        const parsed = stored ? Number.parseFloat(stored) : Number.NaN;
        if (!Number.isFinite(parsed)) return;
        setSplit(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, parsed)));
      } catch {
        // Kein localStorage (privater Modus) — dann bleibt es bei der Vorgabe.
      }
    };

    applyStoredSplit();
  }, [storageKey]);

  const persistSplit = useCallback(
    (value: number) => {
      try {
        window.localStorage.setItem(storageKey, String(value));
      } catch {
        // Siehe oben: Nicht-Speichern ist kein Grund, die Anzeige zu verweigern.
      }
    },
    [storageKey],
  );

  /** Leseposition merken. Fehlschläge bleiben still — das ist Komfort, kein Inhalt. */
  const rememberPosition = useCallback(
    (view: ReaderPageView, explicit: boolean) => {
      void saveSessionBookmarkAction({
        worldSlug,
        sessionId,
        pageId: view.page.id,
        pageTitle: view.page.title,
        anchor: null,
        scrollRatio: scrollRatio.current,
        explicit,
      }).catch(() => undefined);
    },
    [sessionId, worldSlug],
  );

  const openInReading = useCallback(
    async (pageSlug: string) => {
      const view = await reader.load(pageSlug);
      if (!view) return;

      scrollRatio.current = 0;
      setReading(view);
      setReadingAnchor(null);
      rememberPosition(view, false);
    },
    [reader, rememberPosition],
  );

  const openInContext = useCallback(
    async (pageSlug: string) => {
      setContextLoading(true);
      setContextError(null);
      try {
        const view = await reader.load(pageSlug);
        if (!view) {
          setContextError("Diese Seite gibt es (noch) nicht.");
          return;
        }

        setContext((current) => {
          if (current) setContextHistory((stack) => [...stack, current]);
          return view;
        });
        setSheetOpen(true);
      } finally {
        setContextLoading(false);
      }
    },
    [reader],
  );

  const goBackInContext = useCallback(() => {
    setContextHistory((stack) => {
      if (stack.length === 0) return stack;
      const next = stack.slice(0, -1);
      setContext(stack[stack.length - 1]!);
      return next;
    });
  }, []);

  const closeContext = useCallback(() => {
    setContext(null);
    setContextHistory([]);
    setContextError(null);
    setSheetOpen(false);
  }, []);

  const promoteToReading = useCallback(
    async (pageSlug: string) => {
      await openInReading(pageSlug);
      closeContext();
    },
    [closeContext, openInReading],
  );

  // Startseite: das letzte Lesezeichen, sonst die erste verknüpfte Seite.
  useEffect(() => {
    const start = initialPageSlug ?? jumpTargets[0]?.slug ?? null;
    if (!start) return;

    void reader.load(start).then((view) => {
      if (view) setReading(view);
    });
    // Nur beim ersten Rendern — danach steuert die Bedienung, was links steht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const shell = shellRef.current;
      if (!shell) return;

      const bounds = shell.getBoundingClientRect();
      if (bounds.width === 0) return;

      const ratio = ((event.clientX - bounds.left) / bounds.width) * 100;
      const clamped = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, ratio));
      setSplit(clamped);
      persistSplit(clamped);
    },
    [persistSplit],
  );

  return (
    <div className="space-y-3">
      {jumpTargets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Sprungmarken:</span>
          {jumpTargets.map((target) => (
            <Button
              key={target.id}
              type="button"
              variant="outline"
              onClick={() => void openInReading(target.slug)}
            >
              {target.title}
            </Button>
          ))}
        </div>
      ) : null}

      <div
        ref={shellRef}
        onPointerMove={handleDrag}
        onPointerUp={() => {
          dragging.current = false;
        }}
        className="flex h-[70vh] min-h-[28rem] overflow-hidden rounded-lg border border-border"
      >
        <div
          className="min-w-0 flex-1 lg:flex-none"
          style={{ flexBasis: `${split}%` }}
        >
          <ReadingPane
            view={reading}
            loading={reader.loading}
            error={reader.error}
            anchor={readingAnchor}
            onOpenInContext={(slug) => void openInContext(slug)}
            onNavigate={(slug) => void openInReading(slug)}
            onBookmark={() => reading && rememberPosition(reading, true)}
            onScrollPositionChange={(ratio) => {
              scrollRatio.current = ratio;
            }}
          />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Breite der Bereiche"
          tabIndex={0}
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            const next = Math.min(
              MAX_SPLIT,
              Math.max(MIN_SPLIT, split + (event.key === "ArrowLeft" ? -5 : 5)),
            );
            setSplit(next);
            persistSplit(next);
          }}
          className="hidden w-1.5 shrink-0 cursor-col-resize bg-border hover:bg-primary/40 lg:block"
        />

        <div className="hidden min-w-0 flex-1 border-l border-border lg:block">
          <ContextPane
            view={context}
            loading={contextLoading}
            error={contextError}
            historyDepth={contextHistory.length}
            onOpen={(slug) => void openInContext(slug)}
            onBack={goBackInContext}
            onClose={closeContext}
            onPromoteToReading={(slug) => void promoteToReading(slug)}
          />
        </div>
      </div>

      {/*
        Unter lg ist für zwei Spalten kein Platz — dort wird rechts zur Schublade.
        Die Sichtbarkeit hängt an `useCompactViewport`, nicht an einer
        CSS-Klasse: Radix portaliert den Sheet-Inhalt an `document.body`, wo ein
        `lg:hidden` am Elternteil nichts mehr ausrichtet.
      */}
      {compact ? (
        <Sheet open={sheetOpen && context !== null} onOpenChange={setSheetOpen}>
          <SheetContent
            side="right"
            title="Nachgeschlagener Eintrag"
            className="w-[92vw] max-w-[92vw] overflow-hidden bg-background text-foreground"
          >
            <ContextPane
              view={context}
              loading={contextLoading}
              error={contextError}
              historyDepth={contextHistory.length}
              onOpen={(slug) => void openInContext(slug)}
              onBack={goBackInContext}
              onClose={closeContext}
              onPromoteToReading={(slug) => void promoteToReading(slug)}
            />
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
