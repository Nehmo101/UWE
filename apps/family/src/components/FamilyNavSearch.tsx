"use client";

import { NavSearch } from "@uwe/shared-ui";
import { familySearchEntries } from "../navigation/family-nav";

/**
 * Suchleiste der Family-Topbar.
 *
 * Dünner Client-Wrapper: `FamilyShell` ist eine Server-Komponente und kann den
 * Icon-Renderer (eine Funktion) nicht durchreichen — hier wird er gesetzt.
 */
export function FamilyNavSearch() {
  return (
    <NavSearch
      entries={familySearchEntries()}
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
