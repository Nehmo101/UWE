"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { applyThemeById } from "../theme/applyTheme";
import { VineCanvas } from "./VineCanvas";
import { UweLandingLoginCard } from "./UweLandingLoginCard";
import {
  FONT_MONO,
  FONT_SERIF,
  LEADING,
  TEXT_2XL,
  TEXT_2XS,
  TEXT_BASE,
  TEXT_SM,
  TEXT_XS,
  eyebrowStyle,
} from "./landing-shared";
// Landing-page keyframes/pseudo-states live in ./uwe-landing.css, loaded at the
// app layer (studio layout) via "@uwe/shared-ui/uwe-landing.css" — importing CSS
// here would break the package's Node test runner (it can't parse .css).

/**
 * Entry landing page for UWE (uweanddragons.org). One page, two states:
 *   - "choose": hero + two cards (UWE Studio / UWE Portal)
 *   - "studio" | "portal": a per-target in-place sign-in card
 * Locked to the Parchment OS theme; German (du); no emoji; ◆ is the only glyph.
 * Pixel spec: design_handoff_landing_page/README.md.
 *
 * Sign-in authenticates in place against real UWE Core auth (POST /api/auth/enter
 * on the apex/Studio origin) and then navigates to the chosen app's own origin.
 * With SESSION_COOKIE_DOMAIN=.uweanddragons.org the session is domain-wide, so a
 * single sign-in here is valid on studio. and portal.uweanddragons.org (SSO).
 */

type View = "choose" | "studio" | "portal" | "brain";

export interface UweLandingPageProps {
  /** Absolute base URL of the Studio app (its own origin/subdomain). */
  studioAppUrl: string;
  /** Absolute base URL of the Portal app (its own origin/subdomain). */
  portalAppUrl: string;
  /**
   * Absolute base URL of the owner-only Brain surface. Today this shares the
   * Studio origin (Brain routes live in the Studio app); later it can point at
   * a dedicated local/LAN origin. Brain is never part of the public tunnel.
   */
  brainAppUrl: string;
  /** Cloudflare Turnstile site key — when set, sign-in requires a human check. */
  turnstileSiteKey?: string | null;
  /** RTX host reachability shown in the topbar status pill. Defaults to true. */
  rtxOnline?: boolean;
  /**
   * Whether to show the owner-only Brain card. Defaults to true. A deployment
   * that wants Brain hidden from the public entry can pass false (e.g. show it
   * only on LAN) without changing the component contract.
   */
  brainVisible?: boolean;
}

/**
 * Parchment OS token resolutions (README § Design Tokens), applied inline on the
 * landing root so the first server-rendered paint is already correct regardless
 * of the visitor's saved theme, and so the page is self-contained. `--uwe-on-accent`
 * is pinned to the design value (#fbf6ea): the repo derives it to black for the
 * terracotta accent, which would contradict the cream button text in the spec.
 */
const PARCHMENT_TOKENS: CSSProperties = {
  ["--uwe-bg" as string]: "#f1e8d4",
  ["--uwe-bg-elevated" as string]: "#fbf6ea",
  ["--uwe-panel" as string]: "#ece1c9",
  ["--uwe-card-bg" as string]: "#fbf6ea",
  ["--uwe-input-bg" as string]: "#fbf6ea",
  ["--uwe-border" as string]: "#e0d4ba",
  ["--uwe-fg" as string]: "#211d17",
  ["--uwe-fg-muted" as string]: "#574e40",
  ["--uwe-fg-subtle" as string]: "#665d4f",
  ["--uwe-accent" as string]: "#c2622b",
  ["--uwe-accent-hover" as string]: "#d47030",
  ["--uwe-on-accent" as string]: "#fbf6ea",
  ["--uwe-success" as string]: "#2f6f63",
  ["--uwe-warning" as string]: "#e0b15a",
  ["--uwe-danger" as string]: "#c2622b",
  ["--uwe-player-visible" as string]: "#2f6f63",
  ["--uwe-dm-only" as string]: "#c2622b",
  ["--uwe-sidebar-bg" as string]: "#211d17",
  ["--uwe-sidebar-fg" as string]: "#f1e8d4",
  ["--uwe-sidebar-fg-muted" as string]: "#b6ab92",
  ["--uwe-shell-gradient-start" as string]: "rgba(194, 98, 43, 0.03)",
  ["--uwe-focus-shadow" as string]: "color-mix(in srgb, #c2622b 22%, transparent)",
};

const bulletStyle: CSSProperties = { display: "flex", gap: "10px" };

const ctaBaseStyle: CSSProperties = {
  marginTop: "8px",
  alignSelf: "flex-start",
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  padding: "0 20px",
  borderRadius: "9px",
  fontSize: TEXT_SM,
  fontWeight: 700,
};

export function UweLandingPage({
  studioAppUrl,
  portalAppUrl,
  brainAppUrl,
  turnstileSiteKey,
  rtxOnline = true,
  brainVisible = true,
}: UweLandingPageProps) {
  const [view, setView] = useState<View>("choose");
  const [isPhone, setIsPhone] = useState(false);

  // Lock the whole document to Parchment OS regardless of the visitor's saved
  // theme (no theme switcher on the landing page).
  useEffect(() => {
    applyThemeById("uwe-parchment-os");
  }, []);

  // Toggle the "Self-hosted" topbar label on phones (README: hidden ≤560px).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 560px)");
    const onChange = () => setIsPhone(mq.matches);
    mq.addEventListener("change", onChange);
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const rtxDotColor = rtxOnline ? "var(--uwe-success)" : "var(--uwe-warning)";

  return (
    <div
      className="uwe-lp-root"
      data-screen-label="Landing"
      style={{
        ...PARCHMENT_TOKENS,
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: "var(--uwe-fg)",
        fontFamily: FONT_MONO,
        background:
          "radial-gradient(1100px 600px at 70% -10%, var(--uwe-shell-gradient-start), transparent 60%), var(--uwe-bg)",
      }}
    >
      <VineCanvas />

      {/* Topbar */}
      <header
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "54px",
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          padding: "8px clamp(16px, 4vw, 28px)",
          background: "color-mix(in srgb, var(--uwe-panel) 88%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "2px solid var(--uwe-fg)",
        }}
      >
        <button
          type="button"
          onClick={() => setView("choose")}
          className="uwe-lp-ghost uwe-lp-brand"
          aria-label="UWE — zur Auswahl"
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "12px",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--uwe-fg)",
            fontFamily: FONT_MONO,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "-0.02em" }}>◆ UWE</span>
          <span style={{ fontSize: TEXT_XS, color: "var(--uwe-fg-muted)" }}>uweanddragons.org</span>
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: TEXT_XS,
            color: "var(--uwe-fg-muted)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "99px",
                background: rtxDotColor,
                animation: rtxOnline ? "uweLpPulse 2.4s ease infinite" : "none",
              }}
            />
            RTX Host · {rtxOnline ? "online" : "offline — Jobs vorgemerkt"}
          </span>
          <span style={{ display: isPhone ? "none" : "inline" }}>Self-hosted</span>
        </div>
      </header>

      <main
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "clamp(36px, 8vh, 72px) clamp(16px, 4vw, 24px) clamp(32px, 6vh, 64px)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {view === "choose" ? (
          <ChooseView
            onOpenStudio={() => setView("studio")}
            onOpenPortal={() => setView("portal")}
            onOpenBrain={() => setView("brain")}
            brainVisible={brainVisible}
          />
        ) : (
          <UweLandingLoginCard
            target={view}
            appUrl={view === "studio" ? studioAppUrl : view === "brain" ? brainAppUrl : portalAppUrl}
            turnstileSiteKey={turnstileSiteKey}
            onBack={() => setView("choose")}
          />
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          flexWrap: "wrap",
          padding: "20px clamp(16px, 4vw, 24px) calc(20px + env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--uwe-border)",
          fontSize: TEXT_XS,
          color: "var(--uwe-fg-subtle)",
          textAlign: "center",
        }}
      >
        <span>UWE Core · läuft lokal auf deiner Hardware</span>
        <span>·</span>
        <span>Cloud-KI erhält keinen Zugriff auf lokales Brain/Weltwissen.</span>
      </footer>
    </div>
  );
}

function ChooseView({
  onOpenStudio,
  onOpenPortal,
  onOpenBrain,
  brainVisible,
}: {
  onOpenStudio: () => void;
  onOpenPortal: () => void;
  onOpenBrain: () => void;
  brainVisible: boolean;
}) {
  return (
    <>
      <div
        className="uwe-lp-fade-hero"
        style={{
          textAlign: "center",
          maxWidth: "640px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "18px",
        }}
      >
        <div style={eyebrowStyle("var(--uwe-accent)")}>Self-hosted Kampagnen- und Admin-Cockpit</div>
        <h1
          style={{
            margin: 0,
            fontFamily: FONT_SERIF,
            fontWeight: 500,
            fontSize: "clamp(2rem, 7vw, 3.25rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          Universeller Welten-Editor
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: TEXT_BASE,
            lineHeight: LEADING,
            color: "var(--uwe-fg-muted)",
            maxWidth: "46ch",
          }}
        >
          Läuft lokal auf deiner Hardware. Wähle den passenden Einstieg.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: "clamp(16px, 3vw, 24px)",
          justifyContent: "center",
          marginTop: "clamp(32px, 6vh, 56px)",
          width: "100%",
          maxWidth: brainVisible ? "1200px" : "920px",
        }}
      >
        <StudioCard onOpen={onOpenStudio} />
        <PortalCard onOpen={onOpenPortal} />
        {brainVisible ? <BrainCard onOpen={onOpenBrain} /> : null}
      </div>
    </>
  );
}

function StudioCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="uwe-lp-card uwe-lp-fade-card-1"
      style={
        {
          "--uwe-lp-accent": "var(--uwe-accent)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "clamp(20px, 4vw, 28px)",
          borderRadius: "14px",
          background: "var(--uwe-sidebar-bg)",
          color: "var(--uwe-sidebar-fg)",
          border: "1.5px solid var(--uwe-sidebar-bg)",
          boxShadow: "0 1px 2px rgba(0,0,0,.22)",
        } as CSSProperties
      }
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={eyebrowStyle("var(--uwe-accent-hover)")}>Für Spielleiter</span>
        <span
          style={{
            fontSize: TEXT_2XS,
            letterSpacing: "0.04em",
            padding: "3px 9px",
            borderRadius: "99px",
            border: "1px solid var(--uwe-accent)",
            color: "var(--uwe-accent-hover)",
          }}
        >
          Nur GM
        </span>
      </div>
      <div style={{ fontFamily: FONT_SERIF, fontSize: TEXT_2XL, fontWeight: 500, letterSpacing: "-0.02em" }}>
        UWE Studio
      </div>
      <p style={{ margin: 0, fontSize: TEXT_SM, lineHeight: LEADING, color: "var(--uwe-sidebar-fg-muted)" }}>
        Welten bauen, Kampagnen führen, Alltag verwalten — das Cockpit für den GM.
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontSize: TEXT_SM,
          color: "var(--uwe-sidebar-fg-muted)",
        }}
      >
        <li style={bulletStyle}>
          <span style={{ color: "var(--uwe-accent-hover)" }}>◆</span>Welten, NPCs, Orte, Fraktionen, Quests
        </li>
        <li style={bulletStyle}>
          <span style={{ color: "var(--uwe-accent-hover)" }}>◆</span>Sessions, Capture-Inbox, Brain
        </li>
        <li style={bulletStyle}>
          <span style={{ color: "var(--uwe-accent-hover)" }}>◆</span>Lokale KI über RTX Host Connector
        </li>
      </ul>
      <div
        style={{
          ...ctaBaseStyle,
          background: "var(--uwe-accent)",
          color: "var(--uwe-on-accent)",
          border: "2px solid var(--uwe-sidebar-bg)",
        }}
      >
        Studio öffnen →
      </div>
    </div>
  );
}

function PortalCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="uwe-lp-card uwe-lp-fade-card-2"
      style={
        {
          "--uwe-lp-accent": "var(--uwe-player-visible)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "clamp(20px, 4vw, 28px)",
          borderRadius: "14px",
          background: "var(--uwe-card-bg)",
          color: "var(--uwe-fg)",
          border: "1.5px solid var(--uwe-border)",
          boxShadow: "0 1px 2px rgba(0,0,0,.22)",
        } as CSSProperties
      }
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={eyebrowStyle("var(--uwe-player-visible)")}>Für Spieler</span>
        <span
          style={{
            fontSize: TEXT_2XS,
            letterSpacing: "0.04em",
            padding: "3px 9px",
            borderRadius: "99px",
            border: "1px solid var(--uwe-player-visible)",
            color: "var(--uwe-player-visible)",
          }}
        >
          Portal sichtbar
        </span>
      </div>
      <div style={{ fontFamily: FONT_SERIF, fontSize: TEXT_2XL, fontWeight: 500, letterSpacing: "-0.02em" }}>
        UWE Portal
      </div>
      <p style={{ margin: 0, fontSize: TEXT_SM, lineHeight: LEADING, color: "var(--uwe-fg-muted)" }}>
        Öffne deine freigegebenen Welten — Wiki, Handouts und Session-Termine.
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontSize: TEXT_SM,
          color: "var(--uwe-fg-muted)",
        }}
      >
        <li style={bulletStyle}>
          <span style={{ color: "var(--uwe-player-visible)" }}>◆</span>Nur veröffentlichte, spielersichtbare Inhalte
        </li>
        <li style={bulletStyle}>
          <span style={{ color: "var(--uwe-player-visible)" }}>◆</span>Handouts &amp; Kanon deiner Kampagne
        </li>
        <li style={bulletStyle}>
          <span style={{ color: "var(--uwe-player-visible)" }}>◆</span>Nächste Session auf einen Blick
        </li>
      </ul>
      <div
        style={{
          ...ctaBaseStyle,
          background: "var(--uwe-fg)",
          color: "var(--uwe-bg-elevated)",
        }}
      >
        Portal öffnen →
      </div>
    </div>
  );
}

// Owner-only private area (Daily Admin OS + Personal Brain). It lives inside the
// Studio origin today; the card makes the target three-product split visible.
// Per ADR 004/007 Brain stays local/LAN and owner-only — the badge says so.
const BRAIN_ACCENT = "#5c5470";

function BrainCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="uwe-lp-card uwe-lp-fade-card-2"
      style={
        {
          "--uwe-lp-accent": BRAIN_ACCENT,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "clamp(20px, 4vw, 28px)",
          borderRadius: "14px",
          background: "var(--uwe-card-bg)",
          color: "var(--uwe-fg)",
          border: "1.5px solid var(--uwe-border)",
          boxShadow: "0 1px 2px rgba(0,0,0,.22)",
        } as CSSProperties
      }
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={eyebrowStyle(BRAIN_ACCENT)}>Für den Owner</span>
        <span
          style={{
            fontSize: TEXT_2XS,
            letterSpacing: "0.04em",
            padding: "3px 9px",
            borderRadius: "99px",
            border: `1px solid ${BRAIN_ACCENT}`,
            color: BRAIN_ACCENT,
          }}
        >
          Nur Owner · lokal
        </span>
      </div>
      <div style={{ fontFamily: FONT_SERIF, fontSize: TEXT_2XL, fontWeight: 500, letterSpacing: "-0.02em" }}>
        UWE Brain
      </div>
      <p style={{ margin: 0, fontSize: TEXT_SM, lineHeight: LEADING, color: "var(--uwe-fg-muted)" }}>
        Dein privater Alltag und dein Wissen — Daily Admin OS und Personal Brain, lokal auf deiner Hardware.
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontSize: TEXT_SM,
          color: "var(--uwe-fg-muted)",
        }}
      >
        <li style={bulletStyle}>
          <span style={{ color: BRAIN_ACCENT }}>◆</span>Mail, Kalender, Finanzen, Haushalt, Werkstatt
        </li>
        <li style={bulletStyle}>
          <span style={{ color: BRAIN_ACCENT }}>◆</span>Persönliches Wissen &amp; Capture-Inbox
        </li>
        <li style={bulletStyle}>
          <span style={{ color: BRAIN_ACCENT }}>◆</span>Lokale KI — private Inhalte nie in der Cloud
        </li>
      </ul>
      <div
        style={{
          ...ctaBaseStyle,
          background: BRAIN_ACCENT,
          color: "var(--uwe-on-accent)",
        }}
      >
        Brain öffnen →
      </div>
    </div>
  );
}
