"use client";

import { useCallback, useEffect, useRef } from "react";
import { WikiContent } from "@uwe/shared-ui";
import type { ReaderPageView } from "@/src/lib/page-reader";
import { Alert, Badge, Button } from "@/src/components/ui";

interface Props {
  view: ReaderPageView | null;
  loading: boolean;
  error: string | null;
  anchor: string | null;
  /** Ein Wikilink wurde angeklickt — das Ziel gehört ins rechte Pane. */
  onOpenInContext: (pageSlug: string) => void;
  /** Navigation im Lesebereich selbst (Brotkrumen, Vor/Zurück, Unterseiten). */
  onNavigate: (pageSlug: string) => void;
  onBookmark: () => void;
  onScrollPositionChange: (ratio: number) => void;
}

/** Aus `/worlds/terra/npcs/pellar` wird `pellar`. */
function slugFromHref(href: string): string | null {
  const path = href.split("?")[0]?.split("#")[0] ?? "";
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 4 || segments[0] !== "worlds") return null;
  return segments[segments.length - 1] ?? null;
}

export function ReadingPane({
  view,
  loading,
  error,
  anchor,
  onOpenInContext,
  onNavigate,
  onBookmark,
  onScrollPositionChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /**
   * Klicks auf Wikilinks abfangen, statt die Seite zu wechseln.
   *
   * `renderContentHtml` gibt jedem aufgelösten Wikilink `class="wiki-link"` und
   * ein echtes `href` — der Aufhänger war also schon da. Strg/Cmd- und
   * Mittelklick bleiben unangetastet: wer bewusst einen neuen Tab will,
   * bekommt einen.
   */
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (event.button !== 0) return;

      const anchorEl = (event.target as HTMLElement).closest("a.wiki-link");
      if (!(anchorEl instanceof HTMLAnchorElement)) return;

      const slug = slugFromHref(anchorEl.getAttribute("href") ?? "");
      if (!slug) return;

      event.preventDefault();
      onOpenInContext(slug);
    },
    [onOpenInContext],
  );

  // Zur gemerkten Stelle springen, sobald die Seite steht.
  useEffect(() => {
    if (!view || !anchor) return;
    const container = scrollRef.current;
    if (!container) return;

    const target = container.querySelector(`#${CSS.escape(anchor)}`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: "start" });
    }
  }, [anchor, view]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const scrollable = container.scrollHeight - container.clientHeight;
    onScrollPositionChange(scrollable > 0 ? container.scrollTop / scrollable : 0);
  }, [onScrollPositionChange]);

  if (error && !view) {
    return (
      <div className="p-4">
        <Alert tone="danger">{error}</Alert>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {loading ? "Wird geladen…" : "Wähle links eine Seite, um zu lesen."}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <nav aria-label="Pfad" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          {view.trail.map((entry, index) => (
            <span key={entry.id} className="flex items-center gap-1">
              {index > 0 ? <span className="text-muted-foreground">›</span> : null}
              {entry.id === view.page.id ? (
                <span className="font-medium">{entry.title}</span>
              ) : (
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => onNavigate(entry.slug)}
                >
                  {entry.title}
                </button>
              )}
            </span>
          ))}
        </nav>
        <Badge>{view.page.type}</Badge>
        {view.position ? (
          <span className="text-xs text-muted-foreground">
            {view.position} von {view.total}
          </span>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onBookmark}>
            Lesezeichen
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onClick={handleClick}
        className="min-h-0 flex-1 overflow-y-auto p-4"
      >
        {view.brokenLinkCount > 0 ? (
          <Alert tone="info">
            {view.brokenLinkCount} Verweis(e) zeigen auf Seiten, die es noch nicht gibt.
          </Alert>
        ) : null}

        <WikiContent html={view.html} />

        {view.children.length > 0 ? (
          <section className="mt-6 border-t border-border pt-4">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Darunter</h2>
            <ul className="space-y-1">
              {view.children.map((child) => (
                <li key={child.id}>
                  <button
                    type="button"
                    className="text-left underline-offset-2 hover:underline"
                    onClick={() => onNavigate(child.slug)}
                  >
                    {child.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <Button
          type="button"
          variant="outline"
          disabled={!view.previous}
          onClick={() => view.previous && onNavigate(view.previous.slug)}
        >
          ← {view.previous ? view.previous.title.slice(0, 28) : "Anfang"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="ml-auto"
          disabled={!view.next}
          onClick={() => view.next && onNavigate(view.next.slug)}
        >
          {view.next ? view.next.title.slice(0, 28) : "Ende"} →
        </Button>
      </div>
    </div>
  );
}
