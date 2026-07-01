import * as React from "react";

/**
 * @startingPoint section="Navigation" subtitle="Serif page title + actions" viewport="900x160"
 */
export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: React.ReactNode;
  summary?: React.ReactNode;
  /** Meta row (badges, dates) shown under the summary. */
  meta?: React.ReactNode;
  /** Right-aligned action row (buttons). */
  actions?: React.ReactNode;
}

export function PageHeader(props: PageHeaderProps): React.JSX.Element;
