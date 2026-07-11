"use client";

import Link from "next/link";
import { capabilityOfflineMessage } from "@uwe/connector/client";
import type { SoundboardButtonView } from "@uwe/shared-ui";
import { SoundboardWorkspace } from "@uwe/shared-ui";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/src/components/ui";

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
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">Soundboard</h2>
        <p className="text-sm text-muted-foreground">
          Keine Soundboard-Buttons für diese Session —{" "}
          <Link href={setupHref}>Button für diese Session vorbereiten →</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-foreground">Soundboard</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Einklappen" : "Steuerung öffnen"}
        </Button>
        <Link href={setupHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Button vorbereiten →
        </Link>
        <Link
          href={`/worlds/${worldSlug}/soundboard`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Verwalten
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
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
        <div>
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
