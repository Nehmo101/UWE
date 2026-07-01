import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Semantic tone. Default `neutral`. */
  tone?: "neutral" | "accent" | "danger" | "success" | "warning";
}

export function Badge(props: BadgeProps): React.JSX.Element;
