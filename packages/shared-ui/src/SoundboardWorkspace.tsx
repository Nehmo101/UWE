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
  visibility: string;
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
    <span className="uwe-table-sub">
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
      }
    }
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
    <div className="uwe-soundboard">
      {spotifyOAuthEnabled && !useWorldScopedSpotify && hasSpotifyButtons && (
        <section className="uwe-panel" style={{ marginBottom: "1rem" }}>
          <h2>Spotify</h2>
          {!spotifyStatus?.configured && (
            <p className="uwe-table-sub">
              Spotify OAuth ist nicht konfiguriert —{" "}
              <code>SPOTIFY_CLIENT_ID</code> und <code>SPOTIFY_CLIENT_SECRET</code> in{" "}
              <code>.env</code> setzen.
            </p>
          )}
          {spotifyStatus?.configured && !spotifyStatus.connected && (spotifyAuthHref || spotifyConnectHref) && (
            <>
              <p className="uwe-table-sub">
                Spotify-Wiedergabe benötigt Premium, OAuth und ein aktives Spotify Connect-Gerät.
              </p>
              <a className="uwe-btn" href={spotifyConnectHref ?? spotifyAuthHref ?? "#"}>
                Mit Spotify verbinden
              </a>
            </>
          )}
          {spotifyStatus?.connected && (
            <p className="uwe-flash uwe-flash-success" style={{ margin: 0 }}>
              Spotify verbunden — Wiedergabe über Spotify Connect (Premium erforderlich).
            </p>
          )}
        </section>
      )}

      <section className="uwe-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Aktive Sounds</h2>
          {activeSounds.length > 0 && (
            <button type="button" className="uwe-btn" onClick={() => void handleStopAll()}>
              Alle stoppen
            </button>
          )}
        </div>

        {activeSounds.length === 0 && (
          <p className="uwe-empty">Keine aktiven Sounds — Button anklicken zum Abspielen.</p>
        )}

        <ul className="uwe-soundboard-active-list">
          {activeSounds.map((sound) => (
            <li key={sound.instanceId} className="uwe-soundboard-active-item">
              <div>
                <strong>{sound.title}</strong>
                <span className="uwe-badge" style={{ marginLeft: "0.5rem" }}>
                  {sound.sourceType}
                </span>
                {sound.sourceType === "spotify" && spotifyOAuthEnabled && spotifyErrors[sound.instanceId] && (
                  <p className="uwe-flash uwe-flash-error" role="alert">
                    {spotifyErrors[sound.instanceId]}
                  </p>
                )}
                {sound.sourceType === "spotify" && !spotifyOAuthEnabled && (
                  <p className="uwe-table-sub">{spotifyPlaybackHint}</p>
                )}
              </div>
              <div className="uwe-soundboard-controls">
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
                    className="uwe-btn"
                    onClick={() => void handlePause(sound)}
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    className="uwe-btn"
                    onClick={() => void handleResume(sound)}
                  >
                    Weiter
                  </button>
                )}
                <button
                  type="button"
                  className="uwe-btn"
                  onClick={() => void handleStop(sound)}
                >
                  Stop
                </button>
              </div>
              {sound.sourceType === "youtube" && sound.sourceUrl && (
                <div className="uwe-soundboard-youtube">
                  <iframe
                    title={sound.title}
                    src={`https://www.youtube.com/embed/${extractYouTubeVideoId(sound.sourceUrl) ?? ""}?autoplay=${sound.status === "playing" ? 1 : 0}&loop=${sound.loop ? 1 : 0}`}
                    allow="autoplay; encrypted-media"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {allTags.length > 0 && (
        <div className="uwe-filter-bar">
          <button
            type="button"
            className={!tagFilter ? "active" : undefined}
            onClick={() => setTagFilter("")}
          >
            Alle Tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={tagFilter === tag ? "active" : undefined}
              onClick={() => setTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="uwe-soundboard-grid">
        {filteredButtons.map((button) => (
          <button
            key={button.id}
            type="button"
            className="uwe-soundboard-button"
            onClick={() => void handlePlay(button)}
          >
            {button.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={button.thumbnail} alt="" className="uwe-soundboard-thumb" />
            ) : (
              <div className="uwe-soundboard-thumb uwe-soundboard-thumb-placeholder">
                {sourceTypeLabel(button.sourceType)}
              </div>
            )}
            <span className="uwe-soundboard-button-title">{button.title}</span>
            {button.tags.length > 0 && (
              <span className="uwe-soundboard-tags">{button.tags.join(" · ")}</span>
            )}
            {renderLinkedPages(button.linkedPages)}
          </button>
        ))}
      </div>

      {filteredButtons.length === 0 && (
        <p className="uwe-empty">Keine Soundboard-Buttons für diesen Filter.</p>
      )}
    </div>
  );
}
