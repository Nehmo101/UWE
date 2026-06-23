"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoutButton } from "./LogoutButton";

interface AuthHeaderProps {
  user: {
    displayName: string;
    email: string | null;
  } | null;
  canAccessStudio?: boolean;
  studioUrl?: string;
}

/** Legacy auth chrome — prefer PortalAppShell for new pages. */
export function AuthHeader({ user, canAccessStudio = false, studioUrl }: AuthHeaderProps) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="auth-header" data-nav-open={navOpen ? "true" : "false"}>
      <Link href="/auth/worlds" className="auth-header-brand">
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
          Meine Welten
        </Link>
        {canAccessStudio && studioUrl ? (
          <a href={studioUrl} onClick={() => setNavOpen(false)}>
            Studio öffnen
          </a>
        ) : null}
        {user ? (
          <>
            <Link href="/auth/account/password" onClick={() => setNavOpen(false)}>
              Account
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
