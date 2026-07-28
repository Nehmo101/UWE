"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  extractYouTubeVideoId,
  pauseSound,
  playSound,
  resumeSound,
  setSoundVolume,
  stopAllSounds,
  stopSound,
  type ActiveSound,
} from "@uwe/soundboard";
import { cn } from "./components/cn";

export interface SoundboardLinkedPage {
  title: string;
  href?: string;
}

export interface SoundboardButtonView {
  id: string;
  title: string;
  sourceType: "local" | "youtube" | "spotify";
  sourceUrl: string | null;
  assetId: string | null;
  assetFileUrl?: string | null;
  thumbnail: string | null;
  volume: number;
  loop: boolean;
  tags: string[];
  linkedPages: SoundboardLinkedPage[];
}

interface SpotifyConnectionStatus {
  configured: boolean;
  connected: boolean;
  expiresAt: number | null;
  scope: string | null;
}

interface Props {
  buttons: SoundboardButtonView[];
  /** Enables world-scoped Spotify OAuth playback (Studio). */
  worldSlug?: string;
  /** Legacy: enables global Spotify OAuth UI (deprecated — use worldSlug). */
  spotifyReturnPath?: string;
  /** Shown for Spotify sounds when OAuth is unavailable (Portal). */
  spotifyPlaybackHint?: string;
  /** Called after a button starts playback (e.g. live-session status). */
  onButtonPlay?: (button: SoundboardButtonView) => void;
}

function worldSpotifyEndpoint(worldSlug: string, action: string): string {
  return `/api/worlds/${encodeURIComponent(worldSlug)}/spotify/${action}`;
}

function sourceTypeLabel(sourceType: SoundboardButtonView["sourceType"]): string {
  switch (sourceType) {
    case "spotify":
      return "Spotify";
    case "youtube":
      return "YouTube";
    default:
      return "Lokal";
  }
}

async function callSpotifyApi<T extends { ok: boolean; message: string }>(
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return (await response.json()) as T;
}

function renderLinkedPages(pages: SoundboardLinkedPage[]): ReactNode {
  if (pages.length === 0) {
    return null;
  }

  return (
    <span className="mt-1 text-sm text-muted-foreground">
      ↗{" "}
      {pages.map((page, index) => (
        <span key={`${page.title}-${index}`}>
          {index > 0 ? ", " : ""}
          {page.href ? (
            <Link href={page.href} onClick={(event) => event.stopPropagation()}>
              {page.title}
            </Link>
          ) : (
            page.title
          )}
        </span>
      ))}
    </span>
  );
}

export function SoundboardWorkspace({
  buttons,
  worldSlug,
  spotifyReturnPath,
  spotifyPlaybackHint = "Spotify-Wiedergabe wird nur im Studio gesteuert (Spotify Connect / Web API). Im Portal sind Spotify-Buttons nur zur Anzeige.",
  onButtonPlay,
}: Props) {
  const spotifyOAuthEnabled = Boolean(worldSlug) || Boolean(spotifyReturnPath);
  const useWorldScopedSpotify = Boolean(worldSlug);
  const [activeSounds, setActiveSounds] = useState<ActiveSound[]>([]);
  const [tagFilter, setTagFilter] = useState<string>("");
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyConnectionStatus | null>(null);
  const [spotifyErrors, setSpotifyErrors] = useState<Record<string, string>>({});
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const hasSpotifyButtons = useMemo(
    () => buttons.some((button) => button.sourceType === "spotify"),
    [buttons],
  );

  const refreshSpotifyStatus = useCallback(async () => {
    try {
      const statusUrl = worldSlug
        ? worldSpotifyEndpoint(worldSlug, "status")
        : "/api/spotify/status";
      const response = await fetch(statusUrl);
      const payload = worldSlug
        ? ((await response.json()) as SpotifyConnectionStatus)
        : ((await response.json()) as { status: SpotifyConnectionStatus }).status;
      setSpotifyStatus(payload);
    } catch {
      setSpotifyStatus({ configured: false, connected: false, expiresAt: null, scope: null });
    }
  }, [worldSlug]);

  useEffect(() => {
    if (spotifyOAuthEnabled && hasSpotifyButtons) {
      void refreshSpotifyStatus();
    }
  }, [spotifyOAuthEnabled, hasSpotifyButtons, refreshSpotifyStatus]);

  const setSpotifyError = useCallback((instanceId: string, message: string | null) => {
    setSpotifyErrors((prev) => {
      if (!message) {
        const next = { ...prev };
        delete next[instanceId];
        return next;
      }
      return { ...prev, [instanceId]: message };
    });
  }, []);

  const syncSpotifyPlayback = useCallback(
    async (sound: ActiveSound, action: "play" | "pause" | "resume" | "stop" | "volume") => {
      if (sound.sourceType !== "spotify") return true;

      const endpoint = (name: string) =>
        worldSlug ? worldSpotifyEndpoint(worldSlug, name) : `/api/spotify/${name}`;

      let result: { ok: boolean; message: string };

      if (action === "play") {
        if (!sound.sourceUrl) {
          setSpotifyError(sound.instanceId, "Spotify-URL fehlt.");
          return false;
        }
        result = await callSpotifyApi(endpoint("play"), {
          uri: sound.sourceUrl,
          volume: sound.volume,
        });
      } else if (action === "pause") {
        result = await callSpotifyApi(endpoint("pause"));
      } else if (action === "resume") {
        result = await callSpotifyApi(endpoint("resume"));
      } else if (action === "stop") {
        result = await callSpotifyApi(endpoint("stop"));
      } else {
        result = await callSpotifyApi(endpoint("volume"), { volume: sound.volume });
      }

      if (!result.ok) {
        setSpotifyError(sound.instanceId, result.message);
        return false;
      }

      setSpotifyError(sound.instanceId, null);
      return true;
    },
    [setSpotifyError, worldSlug],
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const button of buttons) {
      for (const tag of button.tags) {
        tags.add(tag);
      }
    }
    return [...tags].sort();
  }, [buttons]);

  const filteredButtons = useMemo(() => {
    if (!tagFilter) return buttons;
    return buttons.filter((button) => button.tags.includes(tagFilter));
  }, [buttons, tagFilter]);

  const syncAudioElement = useCallback(
    (sound: ActiveSound) => {
      if (sound.sourceType !== "local" || !sound.assetId) return;

      const button = buttons.find((entry) => entry.id === sound.buttonId);
      if (!button?.assetFileUrl) return;

      let audio = audioRefs.current.get(sound.instanceId);
      if (!audio) {
        audio = new Audio(button.assetFileUrl);
        audioRefs.current.set(sound.instanceId, audio);
      }

      audio.loop = sound.loop;
      audio.volume = sound.volume;

      if (sound.status === "playing") {
        void audio.play().catch(() => undefined);
      } else if (sound.status === "paused") {
        audio.pause();
      } else {
        audio.pause();
        audio.currentTime = 0;
        audioRefs.current.delete(sound.instanceId);
      }
    },
    [buttons],
  );

  useEffect(() => {
    for (const sound of activeSounds) {
      syncAudioElement(sound);
    }

    const activeIds = new Set(activeSounds.map((sound) => sound.instanceId));
    for (const [instanceId, audio] of audioRefs.current.entries()) {
      if (!activeIds.has(instanceId)) {
        audio.pause();
        audioRefs.current.delete(instanceId);
      }
    }
  }, [activeSounds, syncAudioElement]);

  const handlePlay = async (button: SoundboardButtonView) => {
    if (button.sourceType === "spotify") {
      if (spotifyOAuthEnabled) {
        if (!spotifyStatus?.connected) {
          window.alert(
            "Spotify ist nicht verbunden. Bitte zuerst mit Spotify verbinden (Premium + aktives Gerät erforderlich).",
          );
          return;
        }
      } else {
        window.alert(spotifyPlaybackHint);
        return;
      }
    }

    let nextSound: ActiveSound | null = null;

    setActiveSounds((prev) => {
      const result = playSound(
        { sounds: prev },
        {
          id: button.id,
          title: button.title,
          sourceType: button.sourceType,
          sourceUrl: button.sourceUrl,
          assetId: button.assetId,
          volume: button.volume,
          loop: button.loop,
        },
      );
      nextSound = result.sound;
      return result.state.sounds;
    });

    if (nextSound && button.sourceType === "spotify" && spotifyOAuthEnabled) {
      const ok = await syncSpotifyPlayback(nextSound, "play");
      if (!ok) {
        setActiveSounds((prev) => stopSound({ sounds: prev }, nextSound!.instanceId).sounds);
        return;
      }
    }

    onButtonPlay?.(button);
  };

  const handlePause = async (sound: ActiveSound) => {
    if (sound.sourceType === "spotify" && spotifyOAuthEnabled) {
      const ok = await syncSpotifyPlayback(sound, "pause");
      if (!ok) return;
    }
    setActiveSounds((prev) => pauseSound({ sounds: prev }, sound.instanceId).sounds);
  };

  const handleResume = async (sound: ActiveSound) => {
    if (sound.sourceType === "spotify" && spotifyOAuthEnabled) {
      const ok = await syncSpotifyPlayback(sound, "resume");
      if (!ok) return;
    }
    setActiveSounds((prev) => resumeSound({ sounds: prev }, sound.instanceId).sounds);
  };

  const handleStop = async (sound: ActiveSound) => {
    if (sound.sourceType === "spotify" && spotifyOAuthEnabled) {
      await syncSpotifyPlayback(sound, "stop");
    }
    setActiveSounds((prev) => stopSound({ sounds: prev }, sound.instanceId).sounds);
  };

  const handleVolume = async (sound: ActiveSound, volume: number) => {
    const updatedSound = { ...sound, volume };
    setActiveSounds((prev) => setSoundVolume({ sounds: prev }, sound.instanceId, volume).sounds);

    if (sound.sourceType === "spotify" && spotifyOAuthEnabled && sound.status === "playing") {
      await syncSpotifyPlayback(updatedSound, "volume");
    }
  };

  const handleStopAll = async () => {
    if (spotifyOAuthEnabled) {
      const spotifySounds = activeSounds.filter((sound) => sound.sourceType === "spotify");
      for (const sound of spotifySounds) {
        await syncSpotifyPlayback(sound, "stop");
      }
    }
    setActiveSounds(stopAllSounds().sounds);
  };

  const spotifyAuthHref =
    !useWorldScopedSpotify && spotifyReturnPath
      ? `/api/spotify/auth?returnTo=${encodeURIComponent(spotifyReturnPath)}`
      : null;
  const spotifyConnectHref = worldSlug ? worldSpotifyEndpoint(worldSlug, "connect") : null;

  return (
    // uwe-soundboard: no own CSS rule, but kept as an external selector hook —
    // apps/portal/app/globals.css targets `.portal-soundboard-page .uwe-soundboard`.
    <div className="uwe-soundboard">
      {spotifyOAuthEnabled && !useWorldScopedSpotify && hasSpotifyButtons && (
        <section className="mb-4 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm">
          <h2>Spotify</h2>
          {!spotifyStatus?.configured && (
            <p className="mt-1 text-sm text-muted-foreground">
              Spotify OAuth ist nicht konfiguriert —{" "}
              <code>SPOTIFY_CLIENT_ID</code> und <code>SPOTIFY_CLIENT_SECRET</code> in{" "}
              <code>.env</code> setzen.
            </p>
          )}
          {spotifyStatus?.configured && !spotifyStatus.connected && (spotifyAuthHref || spotifyConnectHref) && (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Spotify-Wiedergabe benötigt Premium, OAuth und ein aktives Spotify Connect-Gerät.
              </p>
              <a
                className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] border border-input bg-transparent px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={spotifyConnectHref ?? spotifyAuthHref ?? "#"}
              >
                Mit Spotify verbinden
              </a>
            </>
          )}
          {spotifyStatus?.connected && (
            <p className="rounded-[var(--radius)] border border-success/35 bg-success/15 px-4 py-3 text-success">
              Spotify verbunden — Wiedergabe über Spotify Connect (Premium erforderlich).
            </p>
          )}
        </section>
      )}

      <section className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex items-center justify-between">
          <h2>Aktive Sounds</h2>
          {activeSounds.length > 0 && (
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] border border-input bg-transparent px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void handleStopAll()}
            >
              Alle stoppen
            </button>
          )}
        </div>

        {activeSounds.length === 0 && (
          <p className="text-sm italic text-muted-foreground">Keine aktiven Sounds — Button anklicken zum Abspielen.</p>
        )}

        <ul className="m-0 grid list-none gap-3 p-0">
          {activeSounds.map((sound) => (
            <li key={sound.instanceId} className="rounded-lg border border-border bg-card/40 p-3">
              <div>
                <strong>{sound.title}</strong>
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium">
                  {sound.sourceType}
                </span>
                {sound.sourceType === "spotify" && spotifyOAuthEnabled && spotifyErrors[sound.instanceId] && (
                  <p
                    className="rounded-[var(--radius)] border border-destructive/35 bg-destructive/15 px-4 py-3 text-destructive"
                    role="alert"
                  >
                    {spotifyErrors[sound.instanceId]}
                  </p>
                )}
                {sound.sourceType === "spotify" && !spotifyOAuthEnabled && (
                  <p className="mt-1 text-sm text-muted-foreground">{spotifyPlaybackHint}</p>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label>
                  Lautstärke
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={sound.volume}
                    onChange={(event) =>
                      void handleVolume(sound, Number(event.target.value))
                    }
                  />
                </label>
                {sound.status === "playing" ? (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] border border-input bg-transparent px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => void handlePause(sound)}
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] border border-input bg-transparent px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => void handleResume(sound)}
                  >
                    Weiter
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] border border-input bg-transparent px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => void handleStop(sound)}
                >
                  Stop
                </button>
              </div>
              {sound.sourceType === "youtube" && sound.sourceUrl && (
                <div>
                  <iframe
                    title={sound.title}
                    src={`https://www.youtube.com/embed/${extractYouTubeVideoId(sound.sourceUrl) ?? ""}?autoplay=${sound.status === "playing" ? 1 : 0}&loop=${sound.loop ? 1 : 0}`}
                    allow="autoplay; encrypted-media"
                    className="mt-2 h-[180px] w-full max-w-[320px] rounded-[0.35rem] border-0"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              "rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-[color-mix(in_srgb,var(--uwe-accent)_35%,transparent)] hover:bg-[color-mix(in_srgb,var(--uwe-accent)_15%,transparent)] hover:text-foreground",
              !tagFilter &&
                "border-[color-mix(in_srgb,var(--uwe-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--uwe-accent)_15%,transparent)] text-foreground",
            )}
            onClick={() => setTagFilter("")}
          >
            Alle Tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={cn(
                "rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-[color-mix(in_srgb,var(--uwe-accent)_35%,transparent)] hover:bg-[color-mix(in_srgb,var(--uwe-accent)_15%,transparent)] hover:text-foreground",
                tagFilter === tag &&
                  "border-[color-mix(in_srgb,var(--uwe-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--uwe-accent)_15%,transparent)] text-foreground",
              )}
              onClick={() => setTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 mb-8 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 max-[960px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
        {filteredButtons.map((button) => (
          <button
            key={button.id}
            type="button"
            className="flex cursor-pointer flex-col items-stretch gap-1.5 rounded-lg border border-border bg-card/60 p-2 text-left text-[inherit] hover:border-[color-mix(in_srgb,var(--uwe-accent)_50%,white_15%)]"
            onClick={() => void handlePlay(button)}
          >
            {button.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={button.thumbnail} alt="" className="aspect-square w-full rounded-[0.35rem] object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-[0.35rem] bg-[color-mix(in_srgb,var(--uwe-bg-elevated)_60%,transparent)] text-xs text-muted-foreground">
                {sourceTypeLabel(button.sourceType)}
              </div>
            )}
            <span className="text-sm font-semibold">{button.title}</span>
            {button.tags.length > 0 && (
              <span className="text-xs text-muted-foreground">{button.tags.join(" · ")}</span>
            )}
            {renderLinkedPages(button.linkedPages)}
          </button>
        ))}
      </div>

      {filteredButtons.length === 0 && (
        <p className="text-sm italic text-muted-foreground">Keine Soundboard-Buttons für diesen Filter.</p>
      )}
    </div>
  );
}
