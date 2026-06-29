import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  summary?: string | null;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, summary, meta, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
        {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
