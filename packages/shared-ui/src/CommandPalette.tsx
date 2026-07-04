"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFocusTrap } from "./useFocusTrap";

export interface CommandPaletteCommand {
  id: string;
  label: string;
  /** Zielseite bei Navigations-Befehlen. Entfällt bei Aktions-Befehlen (`run`). */
  href?: string;
  group: string;
  /** Extra match terms beyond the label (e.g. synonyms, slugs). */
  keywords?: string[];
  /** Aktions-Befehl: statt zu navigieren wird diese Funktion ausgeführt. */
  run?: () => void | Promise<void>;
}

export interface CommandPaletteSearchResult {
  id: string;
  label: string;
  href: string;
  group: string;
  hint?: string;
}

/** Pure matcher: every whitespace-separated token must match label/keywords/group. */
export function filterPaletteCommands<
  T extends Pick<CommandPaletteCommand, "label" | "keywords" | "group">,
>(commands: T[], query: string): T[] {
  const tokens = query.trim().toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return commands;

  return commands.filter((command) => {
    const haystack = [command.label, command.group, ...(command.keywords ?? [])]
      .join(" ")
      .toLocaleLowerCase("de");
    return tokens.every((token) => haystack.includes(token));
  });
}

export interface CommandPaletteProps {
  commands: CommandPaletteCommand[];
  /** GET endpoint receiving `?q=`; must return `{ results: CommandPaletteSearchResult[] }`. */
  searchEndpoint?: string;
  placeholder?: string;
  /** Aktiviert eine "Query ausführen"-Zeile am Ende; erhält den rohen Suchtext. */
  onSubmitQuery?: (query: string) => void;
  /** Label der "Query ausführen"-Zeile. */
  submitQueryLabel?: string;
}

interface PaletteEntry {
  id: string;
  label: string;
  href?: string;
  group: string;
  hint?: string;
  run?: () => void | Promise<void>;
}

export function CommandPalette({
  commands,
  searchEndpoint,
  placeholder = "Befehl oder Seite suchen…",
  onSubmitQuery,
  submitQueryLabel = "Als Befehl ausführen",
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<CommandPaletteSearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const footerId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSearchResults([]);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    function onOpenPalette() {
      setOpen(true);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("uwe:open-command-palette", onOpenPalette);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("uwe:open-command-palette", onOpenPalette);
    };
  }, []);

  useFocusTrap({
    active: open,
    containerRef: dialogRef,
    initialFocusRef: inputRef,
    onEscape: close,
  });

  useEffect(() => {
    if (!open || !searchEndpoint || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${searchEndpoint}?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { results?: CommandPaletteSearchResult[] };
        setSearchResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        // Aborted or offline — palette keeps working with static commands.
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query, searchEndpoint]);

  const filteredCommands = useMemo(
    () => filterPaletteCommands(commands, query),
    [commands, query],
  );

  const entries: PaletteEntry[] = useMemo(() => {
    const commandEntries: PaletteEntry[] = filteredCommands.map((command) => ({
      id: `command:${command.id}`,
      label: command.label,
      href: command.href,
      group: command.group,
      run: command.run,
    }));

    const commandHrefs = new Set(commandEntries.map((entry) => entry.href));
    const resultEntries: PaletteEntry[] = searchResults
      .filter((result) => !commandHrefs.has(result.href))
      .map((result) => ({
        id: `search:${result.id}`,
        label: result.label,
        href: result.href,
        group: result.group,
        hint: result.hint,
      }));

    const trimmedQuery = query.trim();
    const submitEntry: PaletteEntry[] =
      onSubmitQuery && trimmedQuery
        ? [
            {
              id: "submit-query",
              label: `${submitQueryLabel}: „${trimmedQuery}“`,
              group: "Befehl",
              run: () => onSubmitQuery(trimmedQuery),
            },
          ]
        : [];

    return [...commandEntries, ...resultEntries, ...submitEntry];
  }, [filteredCommands, searchResults, query, onSubmitQuery, submitQueryLabel]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, entries.length]);

  const navigate = useCallback(
    (entry: PaletteEntry | undefined) => {
      if (!entry) return;
      close();
      if (entry.run) {
        void entry.run();
        return;
      }
      if (entry.href) {
        window.location.assign(entry.href);
      }
    },
    [close],
  );

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, entries.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      navigate(entries[selectedIndex]);
    }
  }

  useEffect(() => {
    const selected = listRef.current?.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  let lastGroup: string | null = null;

  return (
    <div
      className="uwe-palette-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="uwe-palette"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        <input
          ref={inputRef}
          className="uwe-palette-input"
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          aria-label="Befehl oder Seite suchen"
          aria-controls={listboxId}
          aria-describedby={footerId}
          autoComplete="off"
        />
        <ul className="uwe-palette-list" ref={listRef} id={listboxId} role="listbox">
          {entries.length === 0 && (
            <li className="uwe-palette-empty">Keine Treffer für „{query}&ldquo;</li>
          )}
          {entries.map((entry, index) => {
            const showGroup = entry.group !== lastGroup;
            lastGroup = entry.group;

            return (
              <li key={entry.id}>
                {showGroup && <div className="uwe-palette-group">{entry.group}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  data-selected={index === selectedIndex ? "true" : "false"}
                  className="uwe-palette-item"
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => navigate(entry)}
                >
                  <span>{entry.label}</span>
                  {entry.hint && <small>{entry.hint}</small>}
                </button>
              </li>
            );
          })}
        </ul>
        <footer className="uwe-palette-footer" id={footerId} aria-hidden="true">
          <span>↑↓ Navigieren</span>
          <span>↵ Öffnen</span>
          <span>Esc Schließen</span>
        </footer>
      </div>
    </div>
  );
}
