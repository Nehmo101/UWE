"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { CommandPalette, type CommandPaletteCommand } from "@uwe/shared-ui";

interface StudioCommandPaletteProps {
  worlds: { name: string; slug: string }[];
}

const RESERVED_TOP_LEVEL = new Set(["worlds", "search", "backup", "settings", "api"]);

function worldSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/worlds\/([^/]+)/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1]);
  return RESERVED_TOP_LEVEL.has(slug) ? null : slug;
}

export function StudioCommandPalette({ worlds }: StudioCommandPaletteProps) {
  const pathname = usePathname();
  const worldSlug = worldSlugFromPathname(pathname ?? "");

  const commands = useMemo(() => {
    const list: CommandPaletteCommand[] = [];

    if (worldSlug) {
      const base = `/worlds/${worldSlug}`;
      const world = worlds.find((entry) => entry.slug === worldSlug);
      const group = world ? `Welt: ${world.name}` : "Aktuelle Welt";

      list.push(
        { id: "world-overview", label: "Übersicht öffnen", href: `${base}/dashboard`, group, keywords: ["dashboard", "overview"] },
        { id: "world-pages", label: "Seitenliste öffnen", href: base, group, keywords: ["pages", "wiki"] },
        { id: "new-page", label: "Neue Seite erstellen", href: `${base}/pages/new`, group, keywords: ["create", "erstellen"] },
        { id: "new-npc", label: "NPC erstellen", href: `${base}/pages/new?template=npc`, group, keywords: ["create", "charakter"] },
        { id: "new-ort", label: "Ort erstellen", href: `${base}/pages/new?template=ort`, group, keywords: ["create", "location", "stadt"] },
        { id: "new-fraktion", label: "Fraktion erstellen", href: `${base}/pages/new?template=fraktion`, group, keywords: ["create", "faction", "gilde"] },
        { id: "new-quest", label: "Quest erstellen", href: `${base}/pages/new?template=quest`, group, keywords: ["create", "auftrag"] },
        { id: "new-handout", label: "Handout erstellen", href: `${base}/pages/new?template=handout`, group, keywords: ["create", "brief"] },
        { id: "world-sessions", label: "Sessions öffnen", href: `${base}/sessions`, group, keywords: ["spielabend"] },
        { id: "new-session", label: "Session planen", href: `${base}/sessions/new`, group, keywords: ["create", "spielabend"] },
        { id: "world-inspector", label: "Inspektor öffnen", href: `${base}/inspector`, group, keywords: ["sicherheit", "kanon", "leak", "check"] },
        { id: "world-graph", label: "Graph öffnen", href: `${base}/graph`, group, keywords: ["beziehungen", "links"] },
        { id: "world-assets", label: "Assets öffnen", href: `${base}/assets`, group, keywords: ["karten", "bilder", "uploads"] },
        { id: "world-soundboard", label: "Soundboard öffnen", href: `${base}/soundboard`, group, keywords: ["musik", "audio"] },
        { id: "world-notes", label: "Spielernotizen öffnen", href: `${base}/notes`, group, keywords: ["kommentare", "review"] },
        { id: "world-dungeons", label: "Dungeons öffnen", href: `${base}/dungeons`, group, keywords: ["räume", "cockpit"] },
        { id: "world-labels", label: "Labels öffnen", href: `${base}/labels`, group, keywords: ["druck", "handout", "6x4", "label"] },
        { id: "new-label", label: "Neues Label erstellen", href: `${base}/labels/new`, group, keywords: ["create", "label", "handout"] },
        { id: "world-import", label: "Import öffnen", href: `${base}/import`, group, keywords: ["knoteforge"] },
        { id: "world-backup", label: "Welt-Backup öffnen", href: `${base}/backup`, group, keywords: ["sicherung"] },
      );

      const pageMatch = pathname?.match(
        /^\/worlds\/[^/]+\/(?:pages|npcs|orte|fraktionen|quests|handouts|items|notes|encounters|secrets|traps|puzzles|loot|rooms)\/([^/]+)/,
      );
      if (pageMatch) {
        list.push({
          id: "new-label-from-url",
          label: "Label aus aktueller Seite",
          href: `${base}/labels/new`,
          group,
          keywords: ["label", "quelle"],
        });
      }
    }

    list.push(
      { id: "go-today", label: "Heute öffnen", href: "/today", group: "Studio", keywords: ["daily", "cockpit", "start"] },
      { id: "go-capture", label: "Capture öffnen", href: "/capture", group: "Studio", keywords: ["inbox", "notiz", "erfassen"] },
      { id: "go-dashboard", label: "Dashboard öffnen", href: "/", group: "Studio", keywords: ["home", "start"] },
      { id: "go-worlds", label: "Welten öffnen", href: "/worlds", group: "Studio", keywords: ["worlds"] },
      { id: "go-search", label: "Globale Suche öffnen", href: "/search", group: "Studio", keywords: ["finden"] },
      { id: "go-backup", label: "Backup öffnen", href: "/backup", group: "Studio", keywords: ["sicherung", "restore"] },
      { id: "go-settings", label: "Einstellungen öffnen", href: "/settings", group: "Studio", keywords: ["settings", "konfiguration"] },
    );

    for (const world of worlds) {
      if (world.slug === worldSlug) continue;
      list.push({
        id: `open-world-${world.slug}`,
        label: `Welt öffnen: ${world.name}`,
        href: `/worlds/${world.slug}/dashboard`,
        group: "Welten",
        keywords: [world.slug],
      });
    }

    return list;
  }, [worlds, worldSlug, pathname]);

  return (
    <CommandPalette
      commands={commands}
      searchEndpoint="/api/command/search"
      placeholder="Befehl eingeben oder Seite suchen… (Strg/⌘ + K)"
    />
  );
}
