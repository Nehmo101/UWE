import * as React from "react";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional icon node (Lucide glyph), shown centered above the title. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional action row (e.g. a Button). */
  action?: React.ReactNode;
}

export function EmptyState(props: EmptyStateProps): React.JSX.Element;
