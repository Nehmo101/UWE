import Link from "next/link";

export interface BackLinkProps {
  href: string;
  label: string;
  className?: string;
}

/** Logical back navigation — links to a parent list or section, not browser history. */
export function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Link href={href} className={className ?? "uwe-back-link"}>
      <span className="uwe-back-link-icon" aria-hidden>
        ←
      </span>
      {label}
    </Link>
  );
}
