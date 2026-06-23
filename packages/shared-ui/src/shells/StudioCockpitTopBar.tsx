"use client";

import type { ReactNode } from "react";
import { TopBarBrand } from "../AppShell";

export interface StudioCockpitWorldOption {
  name: string;
  slug: string;
}

export interface StudioCockpitTopBarProps {
  worlds: StudioCockpitWorldOption[];
  activeWorldSlug?: string | null;
  searchSlot?: ReactNode;
  endSlot?: ReactNode;
  brandHref?: string;
}

function openCommandPalette() {
  document.dispatchEvent(new CustomEvent("uwe:open-command-palette"));
}

/** Studio cockpit top bar — brand, world switcher, search, command hint, session slot. */
export function StudioCockpitTopBar({
  worlds,
  activeWorldSlug,
  searchSlot,
  endSlot,
  brandHref = "/studio",
}: StudioCockpitTopBarProps) {
  return (
    <div className="uwe-cockpit-topbar">
      <TopBarBrand appName="UWE" subtitle="Studio" href={brandHref} />
      <span className="uwe-cockpit-beta-badge">BETA</span>

      {worlds.length > 0 && (
        <label className="uwe-cockpit-world-switcher">
          <span className="uwe-sr-only">Welt wechseln</span>
          <select
            className="uwe-cockpit-world-select"
            value={activeWorldSlug ?? ""}
            onChange={(event) => {
              const slug = event.target.value;
              if (slug) {
                window.location.href = `/worlds/${slug}/dashboard`;
              }
            }}
          >
            {!activeWorldSlug && <option value="">Welt wählen…</option>}
            {worlds.map((world) => (
              <option key={world.slug} value={world.slug}>
                {world.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {searchSlot}

      <button
        type="button"
        className="uwe-cockpit-command-hint"
        onClick={openCommandPalette}
        title="Befehlspalette öffnen (Strg/⌘ + K)"
      >
        <span className="uwe-cockpit-command-hint-icon" aria-hidden>
          ⌘
        </span>
        <span className="uwe-cockpit-command-hint-label">Suchen…</span>
        <kbd className="uwe-cockpit-command-kbd">K</kbd>
      </button>

      {endSlot}
    </div>
  );
}
