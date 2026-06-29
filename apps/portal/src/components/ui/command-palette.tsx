"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import type { NavCommand } from "@uwe/shared-utils/navigation";
import { NavIcon } from "./icon";
import { cn } from "./cn";

export interface CommandPaletteProps {
  commands: NavCommand[];
  /** Optional extra command groups (e.g. world switcher). */
  extra?: NavCommand[];
}

/**
 * Global command palette (Cmd/Ctrl+K) fed from the central navigation contract.
 * Navigation entries are grouped by their "Section / Group" label.
 */
export function CommandPalette({ commands, extra = [] }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

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

  const all = React.useMemo(() => [...commands, ...extra], [commands, extra]);
  const groups = React.useMemo(() => groupByLabel(all), [all]);

  const run = React.useCallback(
    (command: NavCommand) => {
      setOpen(false);
      if (command.external) {
        window.location.href = command.href;
      } else {
        router.push(command.href);
      }
    },
    [router],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <Command
        label="Befehle"
        className={cn(
          "w-full max-w-lg overflow-hidden rounded-[var(--radius)] border border-border bg-popover text-popover-foreground shadow-lg",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <Command.Input
          autoFocus
          placeholder="Suchen oder springen…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
            Keine Treffer.
          </Command.Empty>
          {groups.map(([groupLabel, items]) => (
            <Command.Group
              key={groupLabel}
              heading={groupLabel}
              className="px-1 py-1 text-xs text-muted-foreground"
            >
              {items.map((command) => (
                <Command.Item
                  key={command.id}
                  value={`${command.label} ${command.keywords.join(" ")}`}
                  onSelect={() => run(command)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground data-[selected=true]:bg-muted"
                >
                  <NavIcon name={command.icon} width={16} height={16} />
                  <span>{command.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

function groupByLabel(commands: NavCommand[]): [string, NavCommand[]][] {
  const map = new Map<string, NavCommand[]>();
  for (const command of commands) {
    const list = map.get(command.group) ?? [];
    list.push(command);
    map.set(command.group, list);
  }
  return [...map.entries()];
}
