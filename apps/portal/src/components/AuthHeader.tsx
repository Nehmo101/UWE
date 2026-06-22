"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoutButton } from "./LogoutButton";

interface AuthHeaderProps {
  user: {
    displayName: string;
    email: string | null;
  } | null;
  canAccessAdmin?: boolean;
  studioSettingsUrl?: string;
}

export function AuthHeader({ user, canAccessAdmin = false, studioSettingsUrl }: AuthHeaderProps) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="auth-header" data-nav-open={navOpen ? "true" : "false"}>
      <Link href="/" className="auth-header-brand">
        UWE Portal
        <small>Spieler-Bereich</small>
      </Link>
      <button
        type="button"
        className="auth-mobile-toggle"
        aria-label={navOpen ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={navOpen}
        onClick={() => setNavOpen((open) => !open)}
      >
        ☰
      </button>
      <nav>
        <Link href="/auth/worlds" onClick={() => setNavOpen(false)}>
          Welten
        </Link>
        {canAccessAdmin && studioSettingsUrl ? (
          <a href={studioSettingsUrl} onClick={() => setNavOpen(false)}>
            Admin / Einstellungen
          </a>
        ) : null}
        {user ? (
          <>
            <Link href="/auth/account/password" onClick={() => setNavOpen(false)}>
              Passwort
            </Link>
            <Link href="/auth/account/security" onClick={() => setNavOpen(false)}>
              Sicherheit
            </Link>
            <LogoutButton displayName={user.displayName} />
          </>
        ) : (
          <Link href="/login" onClick={() => setNavOpen(false)}>
            Anmelden
          </Link>
        )}
      </nav>
    </header>
  );
}
