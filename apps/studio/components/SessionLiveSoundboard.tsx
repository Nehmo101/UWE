"use client";

import type { SoundboardButtonView } from "@uwe/shared-ui";
import { SoundboardWorkspace } from "@uwe/shared-ui";
import { useState } from "react";

interface Props {
  worldSlug: string;
  buttons: SoundboardButtonView[];
}

export function SessionLiveSoundboard({ worldSlug, buttons }: Props) {
  const [open, setOpen] = useState(false);

  if (buttons.length === 0) {
    return (
      <p className="uwe-dashboard-muted">
        Keine Soundboard-Buttons —{" "}
        <a href={`/worlds/${worldSlug}/soundboard`}>Soundboard einrichten →</a>
      </p>
    );
  }

  return (
    <section className="uwe-v2-section">
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <h2 className="uwe-v2-section-title" style={{ margin: 0 }}>
          Soundboard
        </h2>
        <button type="button" className="uwe-v2-btn uwe-v2-btn-small" onClick={() => setOpen((v) => !v)}>
          {open ? "Einklappen" : "Steuerung öffnen"}
        </button>
        <a href={`/worlds/${worldSlug}/soundboard`} className="uwe-v2-btn uwe-v2-btn-small">
          Verwalten →
        </a>
      </div>
      {open ? (
        <div style={{ marginTop: "0.75rem" }}>
          <SoundboardWorkspace buttons={buttons} worldSlug={worldSlug} />
        </div>
      ) : (
        <p className="uwe-dashboard-muted" style={{ marginTop: "0.5rem" }}>
          {buttons.length} Button(s) verfügbar — während der Live-Session abspielen.
        </p>
      )}
    </section>
  );
}
