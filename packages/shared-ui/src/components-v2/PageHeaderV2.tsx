import type { ReactNode } from "react";
import { cn } from "../components/cn";

export type PageHeaderV2Props = {
  title: string;
  summary?: string | null;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeaderV2({
  title,
  summary,
  meta,
  actions,
  className,
}: PageHeaderV2Props) {
  return (
    <header className={cn("uwe-v2-page-header", className)}>
      <div className="uwe-v2-page-header-main">
        <h1>{title}</h1>
        {summary && <p className="uwe-v2-page-summary">{summary}</p>}
        {meta && <div className="uwe-v2-page-meta">{meta}</div>}
      </div>
      {actions && <div className="uwe-v2-page-actions">{actions}</div>}
    </header>
  );
}
