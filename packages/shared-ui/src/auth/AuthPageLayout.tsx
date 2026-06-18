import type { ReactNode } from "react";

export type AuthUiVariant = "studio" | "portal";

export function authClasses(variant: AuthUiVariant) {
  return {
    page: variant === "studio" ? "studio-auth-page" : "auth-page",
    card: variant === "studio" ? "studio-auth-card" : "auth-card",
    cardWide: variant === "studio" ? "studio-auth-card" : "auth-card auth-card-wide",
    lead: variant === "studio" ? "studio-auth-lead" : "auth-lead",
    footer: variant === "studio" ? "studio-auth-footer" : "auth-footer",
    error: variant === "studio" ? "studio-auth-error" : "auth-error",
    form: variant === "studio" ? "studio-auth-form" : "auth-form",
    success: variant === "studio" ? "studio-auth-lead" : "auth-lead",
  };
}

interface AuthPageLayoutProps {
  variant: AuthUiVariant;
  children: ReactNode;
}

export function AuthPageLayout({ variant, children }: AuthPageLayoutProps) {
  const classes = authClasses(variant);
  return <main className={classes.page}>{children}</main>;
}

interface AuthCardProps {
  variant: AuthUiVariant;
  title: string;
  lead?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function AuthCard({ variant, title, lead, children, footer, wide }: AuthCardProps) {
  const classes = authClasses(variant);
  const cardClass = wide && variant === "portal" ? classes.cardWide : classes.card;

  return (
    <section className={cardClass}>
      <h1>{title}</h1>
      {lead && <p className={classes.lead}>{lead}</p>}
      {children}
      {footer && <div className={classes.footer}>{footer}</div>}
    </section>
  );
}
