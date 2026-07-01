import * as React from "react";

export type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "subtle"
  | "ghost"
  | "danger";

/**
 * @startingPoint section="Core" subtitle="Ink & terracotta buttons" viewport="700x150"
 */
export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  /** Visual style. `primary` = ink fill, `accent` = terracotta. Default `secondary`. */
  variant?: ButtonVariant;
  /** Size preset. Default `md`. */
  size?: "sm" | "md" | "lg";
  /** Element/component to render as (e.g. "a"). Default "button". */
  as?: React.ElementType;
  /** Optional leading icon node (a Lucide glyph). */
  icon?: React.ReactNode;
  /** Optional trailing icon node. */
  iconAfter?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  href?: string;
}

export function Button(props: ButtonProps): React.JSX.Element;
