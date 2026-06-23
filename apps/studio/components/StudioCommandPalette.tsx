"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { CommandPalette } from "@uwe/shared-ui";
import { studioCommandPaletteCommands } from "@/src/lib/studio-navigation";

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

  const commands = useMemo(
    () =>
      studioCommandPaletteCommands({
        worlds,
        worldSlug,
        pathname: pathname ?? "",
      }),
    [worlds, worldSlug, pathname],
  );

  return (
    <CommandPalette
      commands={commands}
      searchEndpoint="/api/command/search"
      placeholder="Befehl eingeben oder Seite suchen… (Strg/⌘ + K)"
    />
  );
}
