import type { ReactNode } from "react";
import { AuthBrandingPanel } from "./AuthBrandingPanel";

export type AuthUiVariant = "studio" | "portal";

export function authClasses(variant: AuthUiVariant) {
  return {
    page: "uwe-auth-shell",
    card: variant === "studio" ? "studio-auth-card uwe-auth-card" : "auth-card uwe-auth-card",
    cardWide:
      variant === "studio" ? "studio-auth-card uwe-auth-card" : "auth-card auth-card-wide uwe-auth-card",
    lead: variant === "studio" ? "studio-auth-lead uwe-auth-lead" : "auth-lead uwe-auth-lead",
    footer: variant === "studio" ? "studio-auth-footer uwe-auth-footer" : "auth-footer uwe-auth-footer",
    error: variant === "studio" ? "studio-auth-error uwe-auth-message uwe-auth-message-error" : "auth-error uwe-auth-message uwe-auth-message-error",
    success:
      variant === "studio"
        ? "studio-auth-success uwe-auth-message uwe-auth-message-success"
        : "auth-success uwe-auth-message uwe-auth-message-success",
    form: variant === "studio" ? "studio-auth-form uwe-auth-form" : "auth-form uwe-auth-form",
    link: "uwe-auth-link",
  };
}

interface AuthPageLayoutProps {
  variant: AuthUiVariant;
  children: ReactNode;
  /** Hide branding panel (e.g. compact embedded views). */
  compact?: boolean;
}

export function AuthPageLayout({ variant, children, compact = false }: AuthPageLayoutProps) {
  return (
    <main
      className={`uwe-auth-shell${compact ? " uwe-auth-shell-compact" : ""}`}
      data-auth-variant={variant}
    >
      <div className="uwe-auth-shell-glow" aria-hidden />
      {!compact && <AuthBrandingPanel variant={variant} />}
      <div className="uwe-auth-content">{children}</div>
    </main>
  );
}

interface AuthCardProps {
  variant: AuthUiVariant;
  title: string;
  lead?: string;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function AuthCard({ variant, title, lead, children, footer, wide }: AuthCardProps) {
  const classes = authClasses(variant);
  const cardClass = wide && variant === "portal" ? classes.cardWide : classes.card;

  return (
    <section className={cardClass}>
      <header className="uwe-auth-card-header">
        <h1>{title}</h1>
        {lead && <p className={classes.lead}>{lead}</p>}
      </header>
      {children && <div className="uwe-auth-card-body">{children}</div>}
      {footer && <footer className={classes.footer}>{footer}</footer>}
    </section>
  );
}
