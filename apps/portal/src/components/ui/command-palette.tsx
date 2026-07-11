"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import type { NavCommand } from "@uwe/shared-utils/navigation";
import { NavIcon } from "./icon";
import { cn } from "./cn";

/** Action entry: runs a callback (e.g. a Server Action) instead of navigating. */
export interface CommandPaletteAction {
  id: string;
  label: string;
  group: string;
  icon?: string;
  keywords?: string[];
  run: () => void | Promise<void>;
}

/** Async server-search hit returned from `searchEndpoint`. */
export interface CommandPaletteSearchResult {
  id: string;
  label: string;
  href: string;
  group: string;
  hint?: string;
}

export interface CommandPaletteProps {
  /** Navigation entries fed from the central navigation contract. */
  commands: NavCommand[];
  /** Optional extra navigation groups (e.g. world switcher). */
  extra?: NavCommand[];
  /** Action entries that execute a callback rather than navigating. */
  actions?: CommandPaletteAction[];
  /** GET endpoint receiving `?q=`; must return `{ results: CommandPaletteSearchResult[] }`. */
  searchEndpoint?: string;
  placeholder?: string;
  /** Adds a trailing "run raw query" row (e.g. admin command). Receives the raw search text. */
  onSubmitQuery?: (query: string) => void;
  submitQueryLabel?: string;
}

type NavRow = {
  kind: "nav";
  id: string;
  label: string;
  group: string;
  icon: string;
  value: string;
  href: string;
  external?: boolean;
};

type ActionRow = {
  kind: "action";
  id: string;
  label: string;
  group: string;
  icon: string;
  value: string;
  run: () => void | Promise<void>;
};

type PrimaryRow = NavRow | ActionRow;

const ITEM_CLASS =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-muted";
const GROUP_CLASS = "px-1 py-1 text-xs text-muted-foreground";
const FOCUSABLE_SELECTOR = 'input, button, a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Global command palette (Cmd/Ctrl+K) fed from the central navigation contract.
 * Beyond navigation it supports action entries (callbacks with the app's own
 * feedback), an async server search (via `searchEndpoint`) and a trailing
 * "run raw query" row. Navigation and action entries are filtered client-side by
 * cmdk; server hits and the submit row are `forceMount`ed (already server-filtered).
 */
export function CommandPalette({
  commands,
  extra = [],
  actions = [],
  searchEndpoint,
  placeholder = "Suchen oder springen…",
  onSubmitQuery,
  submitQueryLabel = "Als Befehl ausführen",
}: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<CommandPaletteSearchResult[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);

  // The single Cmd/Ctrl+K listener for the whole Studio app.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Capture the opener on open; reset transient state and restore focus on close.
  React.useEffect(() => {
    if (open) {
      openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    } else {
      setSearch("");
      setResults([]);
      openerRef.current?.focus?.();
    }
  }, [open]);

  const close = React.useCallback(() => setOpen(false), []);

  // Debounced cross-domain server search (parity with the previous palette).
  React.useEffect(() => {
    if (!open || !searchEndpoint || search.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${searchEndpoint}?q=${encodeURIComponent(search.trim())}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { results?: CommandPaletteSearchResult[] };
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        // Aborted or offline — the palette keeps working with static commands.
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, search, searchEndpoint]);

  const navCommands = React.useMemo(() => [...commands, ...extra], [commands, extra]);

  const primaryGroups = React.useMemo(() => {
    const actionRows: ActionRow[] = actions.map((action) => ({
      kind: "action",
      id: action.id,
      label: action.label,
      group: action.group,
      icon: action.icon ?? "zap",
      value: `${action.label} ${(action.keywords ?? []).join(" ")} ${action.id}`,
      run: action.run,
    }));
    const navRows: NavRow[] = navCommands.map((command) => ({
      kind: "nav",
      id: command.id,
      label: command.label,
      group: command.group,
      icon: command.icon,
      value: `${command.label} ${command.keywords.join(" ")} ${command.id}`,
      href: command.href,
      external: command.external,
    }));
    return groupByLabel<PrimaryRow>([...actionRows, ...navRows]);
  }, [actions, navCommands]);

  // Server hits already reachable via a static navigation command are dropped.
  const resultGroups = React.useMemo(() => {
    const knownHrefs = new Set(navCommands.map((command) => command.href));
    return groupByLabel(results.filter((result) => !knownHrefs.has(result.href)));
  }, [results, navCommands]);

  const trimmed = search.trim();
  const showSubmit = Boolean(onSubmitQuery && trimmed);
  const hasExtraRows = resultGroups.length > 0 || showSubmit;

  const runPrimary = React.useCallback(
    (row: PrimaryRow) => {
      close();
      if (row.kind === "action") {
        void row.run();
        return;
      }
      if (row.external) window.location.href = row.href;
      else router.push(row.href);
    },
    [close, router],
  );

  const goto = React.useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  // Focus trap + Escape close. cmdk composes this handler ahead of its own
  // key handling and never acts on Tab/Escape, so trapping here is safe.
  const onContainerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [close],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      role="presentation"
      onClick={close}
    >
      <Command
        ref={containerRef}
        label="Befehle"
        role="dialog"
        aria-modal="true"
        aria-label="Befehle"
        className={cn(
          "w-full max-w-lg overflow-hidden rounded-[var(--radius)] border border-border bg-popover text-popover-foreground shadow-lg",
        )}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onContainerKeyDown}
      >
        <Command.Input
          autoFocus
          onValueChange={setSearch}
          placeholder={placeholder}
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          {!hasExtraRows ? (
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              Keine Treffer.
            </Command.Empty>
          ) : null}

          {primaryGroups.map(([groupLabel, rows]) => (
            <Command.Group key={groupLabel} heading={groupLabel} className={GROUP_CLASS}>
              {rows.map((row) => (
                <Command.Item
                  key={row.id}
                  value={row.value}
                  onSelect={() => runPrimary(row)}
                  className={ITEM_CLASS}
                >
                  <NavIcon name={row.icon} width={16} height={16} />
                  <span>{row.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}

          {resultGroups.map(([groupLabel, rows]) => (
            <Command.Group
              key={`result:${groupLabel}`}
              heading={groupLabel}
              forceMount
              className={GROUP_CLASS}
            >
              {rows.map((result) => (
                <Command.Item
                  key={`result:${result.id}`}
                  value={`result ${result.group} ${result.id}`}
                  forceMount
                  onSelect={() => goto(result.href)}
                  className={ITEM_CLASS}
                >
                  <NavIcon name="file-text" width={16} height={16} />
                  <span className="min-w-0 flex-1 truncate">{result.label}</span>
                  {result.hint ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{result.hint}</span>
                  ) : null}
                </Command.Item>
              ))}
            </Command.Group>
          ))}

          {showSubmit && onSubmitQuery ? (
            <Command.Group key="submit" heading="Befehl" forceMount className={GROUP_CLASS}>
              <Command.Item
                value="uwe-submit-query"
                forceMount
                onSelect={() => {
                  close();
                  onSubmitQuery(trimmed);
                }}
                className={ITEM_CLASS}
              >
                <NavIcon name="terminal" width={16} height={16} />
                <span>{`${submitQueryLabel}: „${trimmed}“`}</span>
              </Command.Item>
            </Command.Group>
          ) : null}
        </Command.List>
      </Command>
    </div>
  );
}

function groupByLabel<T extends { group: string }>(rows: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.group) ?? [];
    list.push(row);
    map.set(row.group, list);
  }
  return [...map.entries()];
}
