import Link from "next/link";

const LINKS = [
  { href: "/", label: "Start" },
  { href: "/today", label: "Heute" },
  { href: "/life-brain", label: "Wissen" },
  { href: "/capture", label: "Capture" },
  { href: "/projects", label: "Projekte" },
  { href: "/workshop", label: "Werkstatt" },
  { href: "/contracts", label: "Verträge" },
  { href: "/hardware", label: "Hardware" },
  { href: "/mail", label: "Mail" },
  { href: "/calendar", label: "Kalender" },
  { href: "/miniatures", label: "Miniaturen" },
] as const;

/** Shared top navigation across the owner-only Brain surfaces. */
export function BrainNav({ active }: { active?: string }) {
  return (
    <nav className="brain-nav" aria-label="Brain">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={active === link.href ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
