import { cn } from "./cn";

export interface SidebarItemProps {
  label: string;
  href: string;
  active?: boolean;
  badge?: string;
  className?: string;
}

export function SidebarItem({
  label,
  href,
  active,
  badge,
  className,
}: SidebarItemProps) {
  return (
    <li>
      <a href={href} className={cn(active && "active", className)}>
        {label}
        {badge && <span className="uwe-nav-badge">{badge}</span>}
      </a>
    </li>
  );
}
