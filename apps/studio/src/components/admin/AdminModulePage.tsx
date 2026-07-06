import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeaderV2 } from "@uwe/shared-ui";
import { BreadcrumbTrail, StudioShell } from "@/src/components/shell";

export interface AdminModulePageProps {
  breadcrumb: ReactNode;
  title: string;
  summary?: string | null;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  headerMeta?: ReactNode;
  headerActions?: ReactNode;
}

/** Shared layout for Daily Admin OS list/detail pages (Parchment v2). */
export function AdminModulePage({
  breadcrumb,
  title,
  summary,
  children,
  backHref = "/today",
  backLabel = "← Heute",
  headerMeta,
  headerActions,
}: AdminModulePageProps) {
  return (
    <StudioShell breadcrumb={breadcrumb}>
      <PageHeaderV2
        title={title}
        summary={summary}
        meta={headerMeta}
        actions={headerActions}
      />
      {children}
      <p className="uwe-dashboard-muted">
        <Link href={backHref}>{backLabel}</Link>
      </p>
    </StudioShell>
  );
}

export { BreadcrumbTrail };
