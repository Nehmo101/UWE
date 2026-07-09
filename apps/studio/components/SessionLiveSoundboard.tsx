"use client";

import Link from "next/link";
import { capabilityOfflineMessage } from "@uwe/connector/client";
import type { SoundboardButtonView } from "@uwe/shared-ui";
import { SoundboardWorkspace } from "@uwe/shared-ui";
import { useCallback, useEffect, useState } from "react";

interface Props {
  worldSlug: string;
  sessionId: string;
  buttons: SoundboardButtonView[];
  campaignSlug?: string | null;
  rtxAudioOnline: boolean;
}

function lastPlayedStorageKey(sessionId: string): string {
  return `uwe:live-soundboard:last-played:${sessionId}`;
}

function readLastPlayedTitle(sessionId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(lastPlayedStorageKey(sessionId));
  } catch {
    return null;
  }
}

function writeLastPlayedTitle(sessionId: string, title: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(lastPlayedStorageKey(sessionId), title);
  } catch {
    /* ignore quota / private mode */
  }
}

function soundboardSetupHref(worldSlug: string, campaignSlug?: string | null): string {
  const base = `/worlds/${worldSlug}/soundboard`;
  return campaignSlug ? `${base}?campaign=${encodeURIComponent(campaignSlug)}` : base;
}

export function SessionLiveSoundboard({
  worldSlug,
  sessionId,
  buttons,
  campaignSlug,
  rtxAudioOnline,
}: Props) {
  const [open, setOpen] = useState(true);
  const [lastPlayedTitle, setLastPlayedTitle] = useState<string | null>(null);

  useEffect(() => {
    setLastPlayedTitle(readLastPlayedTitle(sessionId));
  }, [sessionId]);

  const handleButtonPlay = useCallback(
    (button: SoundboardButtonView) => {
      setLastPlayedTitle(button.title);
      writeLastPlayedTitle(sessionId, button.title);
    },
    [sessionId],
  );

  const setupHref = soundboardSetupHref(worldSlug, campaignSlug);

  if (buttons.length === 0) {
    return (
      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Soundboard</h2>
        <p className="uwe-dashboard-muted">
          Keine Soundboard-Buttons für diese Session —{" "}
          <Link href={setupHref}>Button für diese Session vorbereiten →</Link>
        </p>
      </section>
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
        <Link href={setupHref} className="uwe-v2-btn uwe-v2-btn-small">
          Button vorbereiten →
        </Link>
        <Link href={`/worlds/${worldSlug}/soundboard`} className="uwe-v2-btn uwe-v2-btn-small uwe-v2-btn-ghost">
          Verwalten
        </Link>
      </div>

      <div className="uwe-dashboard-muted" style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <span>{buttons.length} Button(s) — direkt während der Live-Session abspielen.</span>
        {lastPlayedTitle ? <span>Zuletzt: „{lastPlayedTitle}“</span> : null}
        {!rtxAudioOnline ? (
          <span title={capabilityOfflineMessage("audio_local")}>
            {capabilityOfflineMessage("audio_local")} Browser-Wiedergabe bleibt verfügbar.
          </span>
        ) : (
          <span>RTX-Audio online — lokale Ausgabe möglich.</span>
        )}
      </div>

      {open ? (
        <div style={{ marginTop: "0.75rem" }}>
          <SoundboardWorkspace
            buttons={buttons}
            worldSlug={worldSlug}
            onButtonPlay={handleButtonPlay}
          />
        </div>
      ) : null}
    </section>
  );
}
