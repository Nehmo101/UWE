import * as React from "react";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The metric value (string or number). */
  value: React.ReactNode;
  /** Muted label below the value. */
  label: React.ReactNode;
  /** Optional sub-hint (e.g. delta or context). */
  hint?: React.ReactNode;
}

export function StatCard(props: StatCardProps): React.JSX.Element;
