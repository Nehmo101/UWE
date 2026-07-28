import Link from "next/link";
import { BRAIN_NAV_SECTIONS } from "../navigation/brain-nav";

/** Sidebar navigation for the owner-only Brain surfaces. */
export function BrainNav({ active }: { active?: string }) {
  return (
    <>
      {BRAIN_NAV_SECTIONS.map((section) => (
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
