import * as React from "react";

/**
 * @startingPoint section="Core" subtitle="Bordered paper panel" viewport="700x220"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional card title (rendered in the serif face). */
  title?: React.ReactNode;
  /** Optional footer content, separated by a hairline divider. */
  footer?: React.ReactNode;
  /** Apply internal padding. Default true. Set false for edge-to-edge media/lists. */
  padded?: boolean;
}

export function Card(props: CardProps): React.JSX.Element;
