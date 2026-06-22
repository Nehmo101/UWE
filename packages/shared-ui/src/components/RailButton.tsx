import { cn } from "./cn";

export interface RailButtonProps {
  href: string;
  label: string;
  icon: string;
  active?: boolean;
  className?: string;
}

export function RailButton({
  href,
  label,
  icon,
  active,
  className,
}: RailButtonProps) {
  return (
    <a
      href={href}
      className={cn("uwe-rail-button", active && "active", className)}
      aria-label={label}
      title={label}
    >
      <span className="uwe-rail-button-icon" aria-hidden>
        {icon}
      </span>
    </a>
  );
}
