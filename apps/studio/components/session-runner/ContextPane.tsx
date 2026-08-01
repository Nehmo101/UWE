"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { WikiContent } from "@uwe/shared-ui";
import type { ReaderPageView } from "@/src/lib/page-reader";
import { Alert, Badge, Button } from "@/src/components/ui";

interface Props {
  view: ReaderPageView | null;
  loading: boolean;
  error: string | null;
  /** Wie viele Seiten liegen im Stapel hinter der aktuellen. */
  historyDepth: number;
  onOpen: (pageSlug: string) => void;
  onBack: () => void;
  onClose: () => void;
  /** Die aktuelle Kontextseite in den Lesebereich übernehmen. */
  onPromoteToReading: (pageSlug: string) => void;
}

type Tab = "inhalt" | "verweise";

function slugFromHref(href: string): string | null {
  const path = href.split("?")[0]?.split("#")[0] ?? "";
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 4 || segments[0] !== "worlds") return null;
  return segments[segments.length - 1] ?? null;
}

/**
 * Das rechte Pane: der Eintrag, den man gerade nachschlägt.
 *
 * Wikilinks darin wechseln ebenfalls nur dieses Pane — man kann sich also von
 * Xarza zum Flüsterforst und weiter hangeln, ohne dass der Kapiteltext links
 * je die Position verliert. Genau dafür ist der Splitscreen da.
 */
export function ContextPane({
  view,
  loading,
  error,
  historyDepth,
  onOpen,
  onBack,
  onClose,
  onPromoteToReading,
}: Props) {
  const [tab, setTab] = useState<Tab>("inhalt");

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (event.button !== 0) return;

      const anchorEl = (event.target as HTMLElement).closest("a.wiki-link");
      if (!(anchorEl instanceof HTMLAnchorElement)) return;

      const slug = slugFromHref(anchorEl.getAttribute("href") ?? "");
      if (!slug) return;

      event.preventDefault();
      onOpen(slug);
    },
    [onOpen],
  );

  if (!view) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {loading ? "Wird geladen…" : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {!loading && !error
          ? "Klick auf einen [[Verweis]] im Text — der Eintrag erscheint hier, ohne dass du die Stelle verlierst."
          : null}
      </div>
    );
  }

  const referenceCount =
    view.backlinks.length + view.related.length + view.outgoing.filter((l) => l.href).length;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        {historyDepth > 0 ? (
          <Button type="button" variant="outline" onClick={onBack}>
            ← Zurück
          </Button>
        ) : null}
        <span className="min-w-0 truncate font-medium">{view.page.title}</span>
        <Badge>{view.page.type}</Badge>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={() => onPromoteToReading(view.page.slug)}>
            Links lesen
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Schließen
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border px-3 py-2">
        <Button
          type="button"
          variant={tab === "inhalt" ? "default" : "outline"}
          onClick={() => setTab("inhalt")}
        >
          Inhalt
        </Button>
        <Button
          type="button"
          variant={tab === "verweise" ? "default" : "outline"}
          onClick={() => setTab("verweise")}
        >
          Verweise ({referenceCount})
        </Button>
      </div>

      <div onClick={handleClick} className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "inhalt" ? (
          <>
            {view.html ? (
              <WikiContent html={view.html} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Diese Seite hält nur ihre Unterseiten zusammen.
              </p>
            )}
            {view.children.length > 0 ? (
              <section className="mt-4 border-t border-border pt-3">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Darunter</h3>
                <ul className="space-y-1 text-sm">
                  {view.children.map((child) => (
                    <li key={child.id}>
                      <button
                        type="button"
                        className="text-left underline-offset-2 hover:underline"
                        onClick={() => onOpen(child.slug)}
                      >
                        {child.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <div className="space-y-4 text-sm">
            <ReferenceList
              title="Verweist hierher"
              items={view.backlinks.map((entry) => ({ title: entry.title, href: entry.href }))}
              onOpen={onOpen}
            />
            <ReferenceList
              title="Verweist auf"
              items={view.outgoing
                .filter((entry) => entry.href)
                .map((entry) => ({ title: entry.displayText, href: entry.href! }))}
              onOpen={onOpen}
            />
            <ReferenceList
              title="Verwandt"
              items={view.related.map((entry) => ({ title: entry.title, href: entry.href }))}
              onOpen={onOpen}
            />
          </div>
        )}
      </div>

      <div className="border-t border-border p-3 text-xs">
        <Link href={view.page.href} className="text-muted-foreground underline-offset-2 hover:underline">
          Seite im Wiki öffnen →
        </Link>
      </div>
    </div>
  );
}

function ReferenceList({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: Array<{ title: string; href: string }>;
  onOpen: (pageSlug: string) => void;
}) {
  if (items.length === 0) {
    return (
      <section>
        <h3 className="mb-1 font-medium text-muted-foreground">{title}</h3>
        <p className="text-muted-foreground">Nichts.</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-1 font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => {
          const slug = slugFromHref(item.href);
          return (
            <li key={`${item.title}-${item.href}`}>
              {slug ? (
                <button
                  type="button"
                  className="text-left underline-offset-2 hover:underline"
                  onClick={() => onOpen(slug)}
                >
                  {item.title}
                </button>
              ) : (
                <span>{item.title}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
