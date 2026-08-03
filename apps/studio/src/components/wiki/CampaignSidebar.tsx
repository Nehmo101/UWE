import Link from "next/link";
import { cn } from "../ui/cn";

export interface CampaignSidebarItem {
  label: string;
  href: string;
  active?: boolean;
}

/**
 * Die Kampagnen-Liste in der rechten Kontextspalte (`ShellContextPanel`).
 *
 * Zwei Fallen aus dem Basis-CSS, die hier beide zugeschlagen haben:
 *
 *  1. Die Apps binden Tailwind **ohne Preflight** ein (siehe app/globals.css),
 *     also gilt für jedes `<a>` weiterhin die Unterstreichung des User-Agents.
 *     Jeder Kampagnen-Eintrag war unterstrichen — dieselbe Stelle, an der die
 *     Seitenleiste `no-underline` setzt (SidebarNav.tsx).
 *  2. Die ungelayerte Regel `a:not(.uwe-button-surface) { color: var(--uwe-link) }`
 *     in uwe.css schlägt jede Tailwind-Farbklasse aus `@layer utilities`. Der
 *     aktive Eintrag trug `bg-primary text-primary-foreground`: die Fläche kam
 *     an, die Textfarbe nicht — Linkfarbe auf Akzentfläche, praktisch unlesbar.
 *
 * Der aktive Zustand trägt deshalb Fläche, Gewicht und eine Akzentkante statt
 * einer Textfarbe. Die Kante liegt auf beiden Zuständen (transparent, wenn
 * inaktiv), damit die Beschriftung beim Wechsel nicht springt.
 */
export function CampaignSidebar({
  items,
  title = "Kampagne",
  manageHref,
  className,
}: {
  items: CampaignSidebarItem[];
  title?: string;
  /** Ziel für „Kampagnen verwalten" unter der Liste. Ohne Wert kein Fuß. */
  manageHref?: string;
  className?: string;
}) {
  if (items.length === 0 && !manageHref) return null;

  return (
    <nav className={cn("mb-4 flex flex-col gap-2 text-sm", className)} aria-label={title}>
      <div className="text-[length:var(--uwe-text-2xs)] font-semibold uppercase tracking-[var(--uwe-tracking-caps)] text-muted-foreground">
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="flex list-none flex-col gap-px p-0">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "flex min-h-8 items-center rounded-md border-l-2 px-2 py-1.5 no-underline transition-colors",
                  item.active
                    ? "border-primary bg-primary/15 font-medium"
                    : "border-transparent hover:bg-muted",
                )}
              >
                <span className="min-w-0 truncate">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {manageHref ? (
        <Link
          href={manageHref}
          // Keine Textfarb-Utility: siehe Punkt 2 oben — sie käme nicht an. Der
          // Fuß darf die Linkfarbe tragen, er ist ein Link.
          className="flex min-h-8 items-center rounded-md border-l-2 border-transparent px-2 py-1.5 text-xs transition-colors hover:bg-muted"
        >
          Kampagnen verwalten
        </Link>
      ) : null}
    </nav>
  );
}
