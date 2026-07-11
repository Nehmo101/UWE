"use client";

import { useState } from "react";
import {
  maskSecretsInUi,
  type RevealState,
  type SecretLevel,
} from "@uwe/auth/content-access";

export interface SecretRevealProps {
  content: string;
  secretLevel: SecretLevel;
  revealState: RevealState;
  /** Optional placeholder overriding the default masked text. */
  placeholder?: string;
}

/**
 * DM-side player preview for a secret block: shows the masked placeholder a
 * player would see and lets the DM temporarily reveal the underlying text.
 * The full content is only ever sent here for trusted studio (DM) surfaces —
 * never for player/portal rendering (which strips secrets server-side).
 */
export function SecretReveal({ content, secretLevel, revealState, placeholder }: SecretRevealProps) {
  const [revealed, setRevealed] = useState(false);
  const masked = maskSecretsInUi(
    { content, secretLevel, revealState },
    { audience: "player", placeholder },
  );

  if (!masked.masked) {
    return <p style={{ whiteSpace: "pre-wrap" }}>{content}</p>;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p style={{ whiteSpace: "pre-wrap" }}>{revealed ? content : masked.content}</p>
      <button
        type="button"
        className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] bg-transparent px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        aria-expanded={revealed}
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? "Geheimnis verbergen" : "Geheimnis enthüllen"}
      </button>
    </div>
  );
}
