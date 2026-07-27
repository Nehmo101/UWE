import type { ReactNode } from "react";
import Link from "next/link";
import {
  AppAccentScope,
  CrossAppBottomNav,
  SceneHero,
  ThemeModeToggle,
  readClientAppUrls,
} from "@uwe/shared-ui";
import { FamilyNav } from "./FamilyNav";
import { FamilyNavSearch } from "./FamilyNavSearch";

/** Verbindet Umschalter, Hintergrund und Schublade — muss dokumentweit eindeutig sein. */
const NAV_DRAWER_ID = "uwe-family-nav-drawer";

/**
 * Shell shared by every Family surface. Gleiche Chrome-Grammatik wie Studio,
 * Portal und Brain ("Gemalte Welt"); Family teilt sich den Theme-Scope mit
 * Brain (siehe app/layout.tsx).
 *
 * Das Häkchen prüft jede Seite selbst — Daten dürfen für Nicht-Mitglieder gar
 * nicht erst geladen werden. Die Shell ist reine Darstellung.
 */
export function FamilyShell({
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
  const urls = readClientAppUrls();

  return (
    // Family teilt sich Akzent, Szenen und den Bottom-Nav-Slot mit Brain: beide
    // sind lokale Apps mit derselben Optik, und shared-ui kennt (noch) keinen
    // eigenen Family-Scope. Eine eigene Farbwelt waere hier der Ansatzpunkt.
    <AppAccentScope app="brain">
      <div className="uwe-shell" data-has-bottom-nav="true">
        {/* Schublade der App-Navigation auf Mobil: reines CSS (`:has()`), damit
            diese Server-Komponente ohne Client-JS auskommt. Der `key` hängt an
            der aktiven Route — so ist die Schublade nach jedem Seitenwechsel
            wieder zu. */}
        <input
          key={active}
          type="checkbox"
          id={NAV_DRAWER_ID}
          className="uwe-nav-toggle-input"
          aria-label="Navigation ein- oder ausblenden"
        />
        <label className="uwe-sidebar-backdrop" htmlFor={NAV_DRAWER_ID} aria-hidden />
        <header className="uwe-topbar flex-wrap md:flex-nowrap">
          <label className="uwe-mobile-nav-toggle" htmlFor={NAV_DRAWER_ID} aria-hidden>
            ☰
          </label>
          <Link href="/" className="uwe-brand">
            <span className="uwe-brand-mark" aria-hidden>
              ◆
            </span>
            <span>
              <strong>UWE Family</strong>
              <small>Persönliches Wissen &amp; Daily Admin</small>
            </span>
          </Link>
          <FamilyNavSearch />
          <span className="uwe-topbar-end">
            <span className="family-owner-badge">Family</span>
            <ThemeModeToggle />
          </span>
        </header>
        <div className="uwe-shell-body" data-has-sidebar="true" data-has-context="false">
          <aside className="uwe-sidebar">
            <FamilyNav active={active} />
          </aside>
          <main className={sceneIndex === undefined ? "uwe-main" : "uwe-main uwe-scene-host"}>
            {sceneIndex === undefined ? (
              <>
                <span className="family-eyebrow">{eyebrow}</span>
                <div className="family-head">
                  <h1>{title}</h1>
                  {actions ? <div className="family-head-actions">{actions}</div> : null}
                </div>
                {lede ? <p className="family-lede">{lede}</p> : null}
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
        <CrossAppBottomNav
          active="brain"
          startUrl={urls.start}
          studioUrl={urls.studio}
          portalUrl={urls.portal}
          brainUrl={urls.brain}
        />
      </div>
    </AppAccentScope>
  );
}

export function FamilyDenied() {
  return (
    <p className="family-muted">Dieser Bereich braucht das Häkchen &bdquo;Brain&ldquo;.</p>
  );
}
