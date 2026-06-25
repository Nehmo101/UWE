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
    <div className="uwe-secret-reveal">
      <p style={{ whiteSpace: "pre-wrap" }}>{revealed ? content : masked.content}</p>
      <button
        type="button"
        className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm"
        aria-expanded={revealed}
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? "Geheimnis verbergen" : "Geheimnis enthüllen"}
      </button>
    </div>
  );
}
