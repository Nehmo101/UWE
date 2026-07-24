import type { ReactNode } from "react";
import Link from "next/link";
import { AppAccentScope, SceneHero, ThemeModeToggle } from "@uwe/shared-ui";
import { BrainNav } from "./BrainNav";

/**
 * Shell shared by every owner-only Brain surface. It carries the same chrome
 * grammar as Studio and Portal ("Gemalte Welt"); Brain simply defaults to the
 * night half of the pair via its own theme scope (see app/layout.tsx).
 *
 * Owner-gating and data fetching stay in each page (data must not load for
 * non-owners); the shell is purely presentational.
 */
export function BrainShell({
  active,
  title,
  lede,
  eyebrow = "Owner-Bereich · privat",
  actions,
  /**
   * Tagesindex der Szenen-Rotation. Ohne ihn bleibt der Kopf eine schlichte
   * Überschrift — Unterseiten brauchen die Bühne nicht.
   */
  sceneIndex,
  children,
}: {
  active: string;
  title: string;
  lede?: string;
  eyebrow?: string;
  actions?: ReactNode;
  sceneIndex?: number;
  children: ReactNode;
}) {
  return (
    <AppAccentScope app="brain">
      <div className="uwe-shell">
        <header className="uwe-topbar">
          <Link href="/" className="uwe-brand">
            <span className="uwe-brand-mark" aria-hidden>
              ◆
            </span>
            <span>
              <strong>UWE Brain</strong>
              <small>Persönliches Wissen &amp; Daily Admin</small>
            </span>
          </Link>
          <span className="uwe-topbar-end">
            <span className="brain-owner-badge">Nur Owner</span>
            <ThemeModeToggle />
          </span>
        </header>
        <div className="uwe-shell-body" data-has-sidebar="true" data-has-context="false">
          <aside className="uwe-sidebar">
            <BrainNav active={active} />
          </aside>
          <main className={sceneIndex === undefined ? "uwe-main" : "uwe-main uwe-scene-host"}>
            {sceneIndex === undefined ? (
              <>
                <span className="brain-eyebrow">{eyebrow}</span>
                <div className="brain-head">
                  <h1>{title}</h1>
                  {actions ? <div className="brain-head-actions">{actions}</div> : null}
                </div>
                {lede ? <p className="brain-lede">{lede}</p> : null}
              </>
            ) : (
              <SceneHero
                area="brain"
                sceneIndex={sceneIndex}
                size="brain"
                veil="soft"
                groundStart="30%"
                groundEnd="88%"
                eyebrow={eyebrow}
                title={title}
                lede={lede}
                actions={actions}
              />
            )}
            {children}
          </main>
        </div>
      </div>
    </AppAccentScope>
  );
}

export function BrainDenied() {
  return (
    <p className="brain-muted">Dieser Bereich ist ausschließlich für den System-Owner.</p>
  );
}
