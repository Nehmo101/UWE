import * as React from "react";
import { CircleHelp, icons, type LucideProps } from "lucide-react";

/**
 * Navigations-Icons nach Vertragsnamen.
 *
 * Lag in Studio (`src/components/ui/icon.tsx`). Beim Umzug des Mail-Centers nach
 * Brain (H10) brauchten es plötzlich zwei Apps — und `NavSearch` nebenan nimmt
 * den Icon-Renderer bis heute als Prop entgegen, gerade weil hier keiner lag.
 * Also gehört er hierher. Studio re-exportiert weiterhin aus dem alten Pfad.
 */

type LucideComponent = React.ComponentType<LucideProps>;

const registry = icons as unknown as Record<string, LucideComponent>;

/** Convert a kebab-case icon name (as stored in the navigation contract) to PascalCase. */
function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Resolve a navigation icon name to a Lucide component (falls back to a help glyph). */
export function resolveLucideIcon(name: string): LucideComponent {
  return registry[toPascalCase(name)] ?? CircleHelp;
}

export interface NavIconProps extends LucideProps {
  /** Lucide icon name in kebab-case (from the navigation contract). */
  name: string;
}

/** Render a navigation icon by its contract name. */
export function NavIcon({ name, ...props }: NavIconProps) {
  const Component = resolveLucideIcon(name);
  return <Component aria-hidden {...props} />;
}
