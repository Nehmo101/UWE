import Link from "next/link";
import type { BreadcrumbItem } from "@/src/lib/world-breadcrumbs";
export interface BreadcrumbTrailProps { items: BreadcrumbItem[]; className?: string; }
export function BreadcrumbTrail({ items, className }: BreadcrumbTrailProps) {
  if (!items.length) return null;
  return (
    <nav className={className} aria-label="Brotkrumen">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          {item.href ? <Link href={item.href} className="hover:text-foreground">{item.label}</Link> : <span className="text-foreground">{item.label}</span>}
          {i < items.length - 1 ? <span className="mx-1.5 text-muted-foreground/70">/</span> : null}
        </span>
      ))}
    </nav>
  );
}
