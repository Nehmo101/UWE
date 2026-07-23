import type { ReactNode } from "react";
import Link from "next/link";
import { BrainNav } from "./BrainNav";

/**
 * Nachtstudie shell shared by every owner-only Brain surface: inverted
 * Tinte-&-Papier room (ink ground, paper text, candle-gold accent) — same
 * family grammar as Studio (Werkbank) / Portal (Lesesaal), with the
 * "uwe-nachtstudie" theme forced in the root layout.
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
  children,
}: {
  active: string;
  title: string;
  lede?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="uwe-shell">
      <header className="uwe-topbar">
        <Link href="/" className="uwe-brand">
          <span className="uwe-brand-mark" aria-hidden>
            🧠
          </span>
          <span>
            <strong>UWE Brain</strong>
            <small>Persönliches Wissen &amp; Daily Admin</small>
          </span>
        </Link>
        <span className="uwe-topbar-end">
          <span className="brain-owner-badge">Nur Owner</span>
        </span>
      </header>
      <div className="uwe-shell-body" data-has-sidebar="true" data-has-context="false">
        <aside className="uwe-sidebar">
          <BrainNav active={active} />
        </aside>
        <main className="uwe-main">
          <span className="brain-eyebrow">{eyebrow}</span>
          <div className="brain-head">
            <h1>{title}</h1>
            {actions ? <div className="brain-head-actions">{actions}</div> : null}
          </div>
          {lede ? <p className="brain-lede">{lede}</p> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export function BrainDenied() {
  return (
    <p className="brain-muted">Dieser Bereich ist ausschließlich für den System-Owner.</p>
  );
}
