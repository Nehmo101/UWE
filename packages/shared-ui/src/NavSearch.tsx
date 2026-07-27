"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  searchNavEntries,
  type NavSearchEntry,
  type NavSearchHit,
} from "@uwe/shared-utils/nav-search";
import { cn } from "./components/cn";

export interface NavSearchProps {
  /** Durchsuchbare Bereiche — aus dem Navigations-Kontrakt der jeweiligen App. */
  entries: NavSearchEntry[];
  placeholder?: string;
  /** Barrierefreier Name des Feldes. */
  label?: string;
  /** Wrapper-Klassen für Breite/Position in der jeweiligen Topbar. */
  className?: string;
  /** Maximale Zahl der Vorschläge (Default: 8). */
  limit?: number;
  /**
   * Icon-Renderer der App (Studio/Portal reichen ihren `NavIcon` durch).
   * Nur aus Client-Komponenten setzbar — Server-Shells lassen ihn weg.
   */
  renderIcon?: (entry: NavSearchHit) => React.ReactNode;
  /** Taste, die das Feld fokussiert (Default: „/“; `null` schaltet es ab). */
  hotkey?: string | null;
  emptyLabel?: string;
}

/**
 * Die Apps laden Tailwind bewusst ohne Preflight (siehe `globals.css`), deshalb
 * setzen Feld und Zeilen ihre Browser-Vorgaben (`appearance`, Rahmen,
 * Button-Hintergrund) selbst zurück — sonst malt Chrome graue Schaltflächen.
 */
const INPUT_CLASS =
  "h-9 w-full appearance-none rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

/**
 * Für die aktive Zeile wird der Akzent getönt statt `bg-muted` benutzt: In
 * mehreren UWE-Themes ist `--uwe-muted` eine Vordergrundfarbe, ein Feld daraus
 * verschluckt Icon und Bereichs-Hinweis.
 */
const ROW_CLASS =
  "flex w-full cursor-pointer appearance-none items-center gap-2 rounded-md border-0 px-2 py-2 text-left text-sm text-foreground";

/**
 * Suchleiste für Bereiche („springe zu …“), die in Studio, Portal und Brain
 * oben in der Topbar sitzt.
 *
 * Anders als die Cmd/Ctrl+K-Palette ist sie dauerhaft sichtbar und beantwortet
 * genau eine Frage: „Wo finde ich X?“. Die Rangfolge kommt aus
 * `searchNavEntries` (`@uwe/shared-utils/nav-search`) und ist dort unit-getestet;
 * diese Komponente kümmert sich nur um Eingabe, Tastatur und Darstellung.
 */
export function NavSearch({
  entries,
  placeholder = "Bereich suchen…",
  label = "Bereiche durchsuchen",
  className,
  limit = 8,
  renderIcon,
  hotkey = "/",
  emptyLabel = "Kein Bereich gefunden.",
}: NavSearchProps) {
  const router = useRouter();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listId = React.useId();

  const hits = React.useMemo(
    () => searchNavEntries(entries, query, { limit }),
    [entries, query, limit],
  );
  const showList = open && query.trim().length > 0;
  const activeHit = hits[activeIndex] ?? hits[0];

  // Tastenkürzel „/“: fokussiert das Feld, solange nicht gerade getippt wird.
  React.useEffect(() => {
    if (!hotkey) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== hotkey || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hotkey]);

  // Klick außerhalb schließt die Vorschläge, ohne die Eingabe zu verwerfen.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: Event) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  const select = React.useCallback(
    (hit: NavSearchHit | undefined) => {
      if (!hit) return;
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      if (hit.external) window.location.href = hit.href;
      else router.push(hit.href);
    },
    [router],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (query) setQuery("");
        else inputRef.current?.blur();
        setOpen(false);
        return;
      }
      if (event.key === "Tab") {
        setOpen(false);
        return;
      }
      if (hits.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => (index + 1) % hits.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => (index - 1 + hits.length) % hits.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        select(activeHit);
      }
    },
    [activeHit, hits.length, query, select],
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showList && activeHit ? `${listId}-${activeHit.id}` : undefined}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={INPUT_CLASS}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {showList ? (
        <div
          // Schmale Displays: an beiden Kanten des Feldes verankert, sonst ragt
          // die Liste über den linken Bildschirmrand hinaus. `bg-background`
          // statt `bg-card`: die Karten-Token mehrerer Themes sind
          // halbtransparent — darunterliegender Text schiene durch.
          className="absolute inset-x-0 z-40 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-background p-1 shadow-lg sm:left-auto sm:right-0 sm:w-[min(24rem,calc(100vw-1.5rem))]"
        >
          {/* Die Leermeldung steht neben der Liste, nicht darin: eine `listbox`
              darf nur Optionen enthalten. */}
          {hits.length === 0 ? (
            <p role="status" className="px-3 py-4 text-center text-sm text-muted-foreground">
              {emptyLabel}
            </p>
          ) : null}
          <div id={listId} role="listbox" aria-label={label}>
            {hits.map((hit, index) => (
              <button
                key={hit.id}
                id={`${listId}-${hit.id}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                // Der Klick darf das Feld nicht vorher per Blur schließen.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(hit)}
                // Hintergrund als Entweder-oder: zwei `bg-`-Utilities in einer
                // Klassenliste entscheidet sonst die Reihenfolge im Stylesheet.
                className={cn(ROW_CLASS, index === activeIndex ? "bg-primary/15" : "bg-transparent")}
              >
                {renderIcon ? (
                  <span className="flex shrink-0 items-center text-muted-foreground">
                    {renderIcon(hit)}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate">{hit.label}</span>
                {hit.group ? (
                  <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">
                    {hit.group}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
