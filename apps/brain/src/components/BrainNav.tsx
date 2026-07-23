import Link from "next/link";

type NavLink = { href: string; label: string; icon: string };
type NavSection = { title: string; links: NavLink[] };

const SECTIONS: NavSection[] = [
  {
    title: "Überblick",
    links: [
      { href: "/", label: "Start", icon: "◆" },
      { href: "/today", label: "Heute", icon: "☀" },
      { href: "/life-brain", label: "Wissen", icon: "✦" },
      { href: "/capture", label: "Capture", icon: "✎" },
    ],
  },
  {
    title: "Machen",
    links: [
      { href: "/projects", label: "Projekte", icon: "▤" },
      { href: "/workshop", label: "Werkstatt", icon: "⚒" },
      { href: "/miniatures", label: "Miniaturen", icon: "♟" },
    ],
  },
  {
    title: "Verwaltung",
    links: [
      { href: "/contracts", label: "Verträge", icon: "€" },
      { href: "/hardware", label: "Hardware", icon: "▣" },
      { href: "/documents", label: "Dokumente", icon: "▦" },
      { href: "/mail", label: "Mail", icon: "✉" },
      { href: "/calendar", label: "Kalender", icon: "◷" },
    ],
  },
];

/** Sidebar navigation for the owner-only Brain surfaces. */
export function BrainNav({ active }: { active?: string }) {
  return (
    <>
      {SECTIONS.map((section) => (
        <div key={section.title} className="uwe-sidebar-section">
          <h3>{section.title}</h3>
          <nav className="uwe-sidebar-nav" aria-label={section.title}>
            {section.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={active === link.href ? "active" : undefined}
                aria-current={active === link.href ? "page" : undefined}
              >
                <span className="nav-ico" aria-hidden>
                  {link.icon}
                </span>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ))}
    </>
  );
}
