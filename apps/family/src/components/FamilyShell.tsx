import type { ReactNode } from "react";
import Link from "next/link";
import {
  AppAccentScope,
  CrossAppBottomNav,
  SceneHero,
  ThemeModeToggle,
} from "@uwe/shared-ui";
import { resolveCrossAppUrls } from "@uwe/auth";
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
  eyebrow = "Gemeinsamer Bereich",
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
  // Server-Komponente: die Origins kommen aus der Laufzeit-Umgebung
  // (inkl. abgeleiteter Family-Adresse), nicht aus dem Build.
  const urls = resolveCrossAppUrls();

  return (
    // Family hat seit dem v3-Redesign einen eigenen Scope: eigener Akzent
    // (das Blau der Produktkarte auf der Startseite) und ein eigener Szenen-Pool
    // aus den waermeren, bewohnten Motiven. Vorher lief die App mit Brains
    // Violett und Brains Bildern mit und war optisch nicht von Brain zu
    // unterscheiden — obwohl das eine der gemeinsame Haushalt ist und das
    // andere der private Wissensbereich.
    <AppAccentScope app="family">
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
              <small>Gemeinsames Wissen &amp; Haushalt</small>
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
                area="family"
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
          active="family"
          startUrl={urls.start}
          studioUrl={urls.studio}
          portalUrl={urls.portal}
          brainUrl={urls.brain}
          familyUrl={urls.family}
        />
      </div>
    </AppAccentScope>
  );
}

export function FamilyDenied() {
  return (
    <p className="family-muted">Dieser Bereich braucht das Häkchen &bdquo;Family&ldquo;.</p>
  );
}
