"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { NavCommand } from "@uwe/shared-utils/navigation";
import { CommandPalette, type CommandPaletteAction } from "@/src/components/ui/command-palette";
import { pickKnownWorldSlug, worldSlugFromPathname } from "@/src/lib/active-world";
import { studioCommandPaletteCommands } from "@/src/lib/studio-navigation";

interface StudioCommandPaletteProps {
  worlds: { name: string; slug: string }[];
  /** Nur Owner/Admin: aktiviert die "Als Admin-Befehl ausführen"-Zeile. */
  canRunAdminCommands?: boolean;
}

/**
 * The single Studio command palette. Mounted once globally in the root layout so
 * exactly one Cmd/Ctrl+K listener exists app-wide; the previous per-shell mount in
 * AppShell was removed. Server data (worlds, admin flag) arrives as props from the
 * layout Server Component, while the pathname-aware navigation contract is resolved
 * client-side here — a thin wrapper around the cmdk kit palette keeps the data flow
 * explicit without a context provider or prop-drilling through every shell wrapper.
 */

/**
 * Aktions-Befehle (führen etwas aus statt zu navigieren) — überall per Cmd/⌘+K.
 *
 * Aktuell leer: der einzige Eintrag war das Morning Briefing, und das gehört zum
 * Daily Admin OS in Brain (Abschnitt H1).
 */
const ACTION_COMMANDS: CommandPaletteAction[] = [];

export function StudioCommandPalette({
  worlds,
  canRunAdminCommands = false,
}: StudioCommandPaletteProps) {
  const pathname = usePathname();
  // Dieselbe Regel wie im Shell (`active-world.ts`): der Pfad-Slug zählt nur,
  // wenn es die Welt wirklich gibt. Die frühere Blacklist reservierter
  // Segmente riet nur — sie hätte eine Welt namens „settings" ausgesperrt und
  // eine erfundene durchgelassen.
  const worldSlug = pickKnownWorldSlug(
    worldSlugFromPathname(pathname ?? ""),
    worlds.map((world) => world.slug),
  );

  const commands = useMemo<NavCommand[]>(
    () =>
      studioCommandPaletteCommands({
        worlds,
        worldSlug,
        pathname: pathname ?? "",
      }).map((command) => ({
        id: command.id,
        label: command.label,
        href: command.href,
        group: command.group,
        icon: command.icon ?? "arrow-right",
        keywords: command.keywords ?? [],
      })),
    [worlds, worldSlug, pathname],
  );

  return (
    <CommandPalette
      commands={commands}
      actions={ACTION_COMMANDS}
      searchEndpoint="/api/command/search"
      placeholder="Befehl eingeben oder Seite suchen… (Strg/⌘ + K)"
      onSubmitQuery={
        canRunAdminCommands
          ? (query) => window.location.assign(`/command?q=${encodeURIComponent(query)}`)
          : undefined
      }
      submitQueryLabel="Als Admin-Befehl ausführen"
    />
  );
}
