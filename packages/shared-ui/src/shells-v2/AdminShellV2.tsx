import type { ReactNode } from "react";
import type { BottomNavItem } from "../MobileComponents";
import { AppShellV2, V2PageHeader, V2TopBarBrand } from "./AppShellV2";

export interface AdminShellV2Props {
  main: ReactNode;
  activePath: string;
  navItems: { label: string; href: string; active?: boolean; badge?: string }[];
  title: string;
  summary: string;
  actions?: ReactNode;
  bottomNav?: BottomNavItem[];
  statusStrip?: ReactNode;
  brandHref?: string;
  backToStudioHref?: string;
  backToStudioLabel?: string;
}

/** Design V2 admin shell — status-oriented layout with back-to-studio link. */
export function AdminShellV2({
  main,
  activePath: _activePath,
  navItems,
  title,
  summary,
  actions,
  bottomNav,
  statusStrip,
  brandHref = "/admin",
  backToStudioHref = "/today",
  backToStudioLabel = "Zurück zum Studio",
}: AdminShellV2Props) {
  return (
    <AppShellV2
      bottomNav={bottomNav}
      topBar={<V2TopBarBrand appName="UWE Studio" subtitle="Admin" href={brandHref} />}
      sidebar={
        <>
          <a href={backToStudioHref} className="uwe-v2-admin-back">
            ← {backToStudioLabel}
          </a>
          <section className="uwe-sidebar-section">
            <h3>Admin</h3>
            <nav className="uwe-sidebar-nav" aria-label="Administration">
              <ul>
                {navItems.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className={item.active ? "active" : undefined}
                      aria-current={item.active ? "page" : undefined}
                    >
                      {item.label}
                      {item.badge ? <span className="uwe-badge">{item.badge}</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </section>
        </>
      }
      main={
        <>
          <V2PageHeader title={title} summary={summary} actions={actions} />
          {statusStrip}
          {main}
        </>
      }
    />
  );
}

export function AdminStatusGridV2({ children }: { children: ReactNode }) {
  return <div className="uwe-admin-status-grid">{children}</div>;
}

export function AdminStatusCardV2({
  title: cardTitle,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="uwe-admin-status-card uwe-card">
      <h3 className="uwe-admin-status-card-title">{cardTitle}</h3>
      <div className="uwe-admin-status-card-body">{children}</div>
      {actions ? <div className="uwe-admin-status-card-actions">{actions}</div> : null}
    </article>
  );
}
