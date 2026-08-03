import * as React from "react";
import { CircleHelp, icons, type LucideProps } from "lucide-react";

type LucideComponent = React.ComponentType<LucideProps>;

const registry = icons as unknown as Record<string, LucideComponent>;

function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function resolveLucideIcon(name: string): LucideComponent {
  return registry[toPascalCase(name)] ?? CircleHelp;
}

export interface NavIconProps extends LucideProps {
  name: string;
}

export function NavIcon({ name, ...props }: NavIconProps) {
  const Component = resolveLucideIcon(name);
  return <Component aria-hidden {...props} />;
}
