"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { NavCommand } from "@uwe/shared-utils/navigation";
import { CommandPalette, type CommandPaletteAction } from "@/src/components/ui/command-palette";
import { studioCommandPaletteCommands } from "@/src/lib/studio-navigation";
import { generateMorningBriefingAction } from "@/app/briefing-actions";

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

/** Aktions-Befehle (führen etwas aus statt zu navigieren) — überall per Cmd/⌘+K. */
const ACTION_COMMANDS: CommandPaletteAction[] = [
  {
    id: "action-briefing",
    label: "Morning Briefing erstellen",
    group: "Aktionen",
    icon: "sparkles",
    keywords: ["briefing", "ki", "zusammenfassung", "heute", "tag", "agenda"],
    run: async () => {
      try {
        await generateMorningBriefingAction();
      } finally {
        // Feedback per Navigation: /today zeigt den Briefing-Status.
        window.location.assign("/today");
      }
    },
  },
];

const RESERVED_TOP_LEVEL = new Set(["worlds", "search", "backup", "settings", "api"]);

function worldSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/worlds\/([^/]+)/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1]);
  return RESERVED_TOP_LEVEL.has(slug) ? null : slug;
}

export function StudioCommandPalette({
  worlds,
  canRunAdminCommands = false,
}: StudioCommandPaletteProps) {
  const pathname = usePathname();
  const worldSlug = worldSlugFromPathname(pathname ?? "");

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
