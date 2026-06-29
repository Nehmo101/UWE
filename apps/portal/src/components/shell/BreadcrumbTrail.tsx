import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbTrailProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function BreadcrumbTrail({ items, className }: BreadcrumbTrailProps) {
  if (!items.length) return null;

  return (
    <nav className={className} aria-label="Brotkrumen">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
          {index < items.length - 1 ? (
            <span className="mx-1.5 text-muted-foreground/70">/</span>
          ) : null}
        </span>
      ))}
    </nav>
  );
}
