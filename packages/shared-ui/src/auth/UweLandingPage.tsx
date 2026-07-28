"use client";

import { useState } from "react";
import { AppAccentScope } from "../scene/AppAccentScope";
import { CrossAppBottomNav } from "../scene/CrossAppBottomNav";
import { PaintedScene } from "../scene/PaintedScene";
import { ThemeModeToggle } from "../scene/ThemeModeToggle";
import { UweLandingChoices, type LandingTarget } from "./UweLandingChoices";
import { UweLandingLoginCard } from "./UweLandingLoginCard";
// Landing-Layout, Keyframes und Media-Queries liegen in ./uwe-landing.css,
// geladen auf App-Ebene (Studio-Layout) via "@uwe/shared-ui/uwe-landing.css" —
// ein CSS-Import hier bräche den Node-Test-Runner des Pakets.

/**
 * Einstiegsseite von UWE (uweanddragons.org). Eine Seite, zwei Zustände:
 *   - "choose": gemalte Szene + Hero + drei Produktkarten
 *   - "studio" | "portal" | "brain": die Anmeldekarte des jeweiligen Ziels
 *
 * Die Anmeldung läuft unverändert gegen die echte UWE-Core-Auth
 * (POST /api/auth/enter auf dem Apex-/Studio-Origin) und navigiert danach zum
 * eigenen Origin der Ziel-App. Mit SESSION_COOKIE_DOMAIN=.uweanddragons.org
 * gilt eine Anmeldung hier auf allen Produkt-Subdomains (SSO).
 *
 * Design: design_handoff_ghibli_redesign/README.md, Abschnitt „1 · Landing".
 * Anders als die Vorgängerversion nagelt diese Seite kein Theme fest — der
 * Hell/Dunkel-Umschalter in der Nav schaltet zwischen den beiden Hälften der
 * „Gemalten Welt" und persistiert über die normale Theme-Persistenz.
 */

type View = "choose" | LandingTarget;

export interface UweLandingPageProps {
  /** Absolute base URL of the Studio app (its own origin/subdomain). */
  studioAppUrl: string;
  /** Absolute base URL of the Portal app (its own origin/subdomain). */
  portalAppUrl: string;
  /**
   * Absolute base URL of the owner-only Brain surface. It may share the Studio
   * origin or live on its own (loopback, LAN, or a public origin behind the
   * owner-gated tunnel) — Brain enforces the `owner` role on every route either
   * way.
   */
  brainAppUrl: string;
  /**
   * Absolute base URL der Family-App. Wie Brain eine eigene lokale App; der
   * Zugang hängt am Häkchen `Family`, nicht an einer Rolle.
   */
  familyAppUrl: string;
  /** Cloudflare Turnstile site key — when set, sign-in requires a human check. */
  turnstileSiteKey?: string | null;
  /** RTX host reachability shown in the nav status pill. Defaults to true. */
  rtxOnline?: boolean;
  /**
   * Whether to show the owner-only Brain card. Defaults to true. A deployment
   * that wants Brain hidden from the public entry can pass false without
   * changing the component contract.
   */
  brainVisible?: boolean;
  /** Dito für Family. */
  familyVisible?: boolean;
  /**
   * Tagesindex der Szenen-Rotation, serverseitig aus `dayIndex()` berechnet und
   * durchgereicht. Ein clientseitig ermittelter Wert würde um Mitternacht bzw.
   * bei abweichender Serverzone einen Hydration-Mismatch erzeugen.
   */
  sceneIndex: number;
}

export function UweLandingPage({
  studioAppUrl,
  portalAppUrl,
  brainAppUrl,
  familyAppUrl,
  turnstileSiteKey,
  rtxOnline = true,
  brainVisible = true,
  familyVisible = true,
  sceneIndex,
}: UweLandingPageProps) {
  const [view, setView] = useState<View>("choose");

  const APP_URLS: Record<LandingTarget, string> = {
    studio: studioAppUrl,
    portal: portalAppUrl,
    brain: brainAppUrl,
    family: familyAppUrl,
  };
  const appUrlFor = (target: LandingTarget) => APP_URLS[target];

  return (
    <AppAccentScope app="studio" layout="block">
      <div className="uwe-lp-root" data-screen-label="Landing">
        <PaintedScene area="landing" sceneIndex={sceneIndex} topShade groundStart="42%" groundEnd="96%" />

        <nav className="uwe-lp-nav">
          <button
            type="button"
            onClick={() => setView("choose")}
            className="uwe-lp-brand"
            aria-label="UWE — zur Auswahl"
          >
            <strong>◆ UWE</strong>
            <small>uweanddragons.org</small>
          </button>
          <div className="uwe-lp-nav-end">
            <span className="uwe-lp-rtx" data-online={rtxOnline ? "true" : "false"}>
              <span className="uwe-lp-rtx-dot" />
              RTX Host · {rtxOnline ? "online" : "offline — Jobs vorgemerkt"}
            </span>
            <ThemeModeToggle size="nav" />
          </div>
        </nav>

        <main className="uwe-lp-main">
          {view === "choose" ? (
            <>
              <div className="uwe-lp-hero">
                <div className="uwe-lp-eyebrow">
                  {/* Die Langfassung passt bei 0.18em Sperrung nicht auf ein
                      Telefon — die Kurzfassung ist die des Handoffs. */}
                  <span className="uwe-lp-eyebrow-long">
                    Self-hosted Kampagnen- und Admin-Cockpit
                  </span>
                  <span className="uwe-lp-eyebrow-short">Self-hosted Cockpit</span>
                </div>
                <h1 className="uwe-lp-title">Universeller Welten-Editor</h1>
                <p className="uwe-lp-lede">Läuft lokal auf deiner Hardware.</p>
              </div>
              <UweLandingChoices
                onOpen={setView}
                brainVisible={brainVisible}
                familyVisible={familyVisible}
              />
            </>
          ) : (
            <div className="uwe-lp-login-wrap">
              <UweLandingLoginCard
                target={view}
                appUrl={appUrlFor(view)}
                turnstileSiteKey={turnstileSiteKey}
                onBack={() => setView("choose")}
              />
            </div>
          )}
        </main>

        <CrossAppBottomNav
          active="start"
          startUrl="/"
          studioUrl={studioAppUrl}
          portalUrl={portalAppUrl}
          brainUrl={brainAppUrl}
          familyUrl={familyAppUrl}
          brainVisible={brainVisible}
          familyVisible={familyVisible}
        />

        <footer className="uwe-lp-footer">
          <span>UWE Core · läuft lokal auf deiner Hardware</span>
          <span>·</span>
          <span>Cloud-KI erhält keinen Zugriff auf lokales Brain/Weltwissen.</span>
        </footer>
      </div>
    </AppAccentScope>
  );
}
