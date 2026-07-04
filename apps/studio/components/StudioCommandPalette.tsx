"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { CommandPalette, type CommandPaletteCommand } from "@uwe/shared-ui";
import { studioCommandPaletteCommands } from "@/src/lib/studio-navigation";
import { generateMorningBriefingAction } from "@/app/briefing-actions";

interface StudioCommandPaletteProps {
  worlds: { name: string; slug: string }[];
  /** Nur Owner/Admin: aktiviert die "Als Admin-Befehl ausführen"-Zeile. */
  canRunAdminCommands?: boolean;
}

/** Aktions-Befehle (führen etwas aus statt zu navigieren) — überall per Cmd/⌘+K. */
const ACTION_COMMANDS: CommandPaletteCommand[] = [
  {
    id: "action-briefing",
    label: "Morning Briefing erstellen",
    group: "Aktionen",
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

  const commands = useMemo(
    () => [
      ...ACTION_COMMANDS,
      ...studioCommandPaletteCommands({
        worlds,
        worldSlug,
        pathname: pathname ?? "",
      }),
    ],
    [worlds, worldSlug, pathname],
  );

  return (
    <CommandPalette
      commands={commands}
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
