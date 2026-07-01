import * as React from "react";

export interface SecretRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Header label. Default "GM-Geheimnis". */
  label?: React.ReactNode;
  /** Reveal-button text. Default "Enthüllen". */
  revealHint?: React.ReactNode;
  /** Start in the revealed state. Default false. */
  defaultRevealed?: boolean;
}

/** Spoiler container: blurs child content until the reader reveals it. */
export function SecretReveal(props: SecretRevealProps): React.JSX.Element;
