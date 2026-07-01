import * as React from "react";

export interface BrandProps extends React.HTMLAttributes<HTMLElement> {
  /** Wordmark text. Default "UWE". First letter goes in the boxed glyph. */
  appName?: string;
  /** Optional subtitle under the wordmark (e.g. "Studio"). */
  subtitle?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Render as a link when provided. */
  href?: string;
}

export function Brand(props: BrandProps): React.JSX.Element;
