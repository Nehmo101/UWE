import * as React from "react";
import { CircleHelp, icons, type LucideProps } from "lucide-react";

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
