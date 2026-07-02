import type { ReactNode } from "react";

export function AdminStatusGrid({ children }: { children: ReactNode }) {
  return <div className="uwe-admin-status-grid">{children}</div>;
}

export function AdminStatusCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="uwe-admin-status-card uwe-card">
      <h3 className="uwe-admin-status-card-title">{title}</h3>
      <div className="uwe-admin-status-card-body">{children}</div>
      {actions && <div className="uwe-admin-status-card-actions">{actions}</div>}
    </article>
  );
}
