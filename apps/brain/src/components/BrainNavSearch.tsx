"use client";

import { NavSearch } from "@uwe/shared-ui";
import { brainSearchEntries } from "../navigation/brain-nav";

/**
 * Suchleiste der Brain-Topbar.
 *
 * Dünner Client-Wrapper: `BrainShell` ist eine Server-Komponente und kann den
 * Icon-Renderer (eine Funktion) nicht durchreichen — hier wird er gesetzt.
 */
export function BrainNavSearch() {
  return (
    <NavSearch
      entries={brainSearchEntries()}
      // Schmale Displays: eigene Zeile unter Marke und Bedienelementen.
      className="order-10 w-full md:order-none md:ml-auto md:w-72"
      placeholder="Bereich suchen…"
      renderIcon={(hit) => (
        <span aria-hidden className="text-base leading-none">
          {hit.icon}
        </span>
      )}
    />
  );
}
