import * as React from "react";
import type { ResolvedNavGroup } from "@uwe/shared-utils/navigation";
import { NavIcon } from "./NavIcon";

export interface ConnectorShellProps {
  /** Resolved nav groups (with active flags) from connectorSidebar(). */
  groups: ResolvedNavGroup[];
  brandLabel: string;
  brandKicker?: string;
  brandDescription?: string;
  /** Called when the user selects a nav item; receives the item's href. */
  onNavigate: (href: string) => void;
  /** Header right-side content (e.g. status badge + reload button). */
  headerActions?: React.ReactNode;
  /** Banner shown below the header (success/error/info). */
  banner?: React.ReactNode;
  /** Overlay content (e.g. SetupWizard). Rendered above the shell. */
  overlay?: React.ReactNode;
  /** Boot/loading screen shown before the shell is ready. */
  loading?: boolean;
  loadingLabel?: string;
  children: React.ReactNode;
}

/**
 * RTX Connector Client shell: sidebar driven by connector-nav IA +
 * top header + main content area. Tauri/Vite-friendly (no Next.js Link).
 */
export function ConnectorShell({
  groups,
  brandLabel,
  brandKicker,
  brandDescription,
  onNavigate,
  headerActions,
  banner,
  overlay,
  loading = false,
  loadingLabel = "Lade RTX Connector Client …",
  children,
}: ConnectorShellProps) {
  if (loading) {
    return <div className="connector-boot">{loadingLabel}</div>;
  }

  const activeItem = groups
    .flatMap((g) => g.items)
    .find((item) => item.active);
  const activeLabel = activeItem?.label ?? "";

  return (
    <div className="connector-shell">
      {overlay ?? null}

      <aside className="connector-sidebar">
        <div className="connector-brand">
          {brandKicker ? <span className="connector-kicker">{brandKicker}</span> : null}
          <h1>{brandLabel}</h1>
          {brandDescription ? <p>{brandDescription}</p> : null}
        </div>

        <nav className="connector-nav" aria-label="Hauptnavigation">
          {groups.flatMap((group) =>
            group.items
              .filter((item) => item.status !== "hidden")
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`connector-nav-item${item.active ? " is-active" : ""}`}
                  onClick={() => onNavigate(item.href)}
                  aria-current={item.active ? "page" : undefined}
                >
                  <span className="connector-nav-item-inner">
                    <NavIcon name={item.icon} width={16} height={16} />
                    <span>{item.label}</span>
                  </span>
                  {item.status === "planned" ? (
                    <small className="connector-nav-badge">bald</small>
                  ) : null}
                </button>
              )),
          )}
        </nav>
      </aside>

      <main className="connector-main">
        <header className="connector-header">
          <div>
            <h2>{activeLabel}</h2>
          </div>
          {headerActions ? (
            <div className="connector-header-actions">{headerActions}</div>
          ) : null}
        </header>

        {banner ?? null}

        <section className="connector-content">{children}</section>
      </main>
    </div>
  );
}
