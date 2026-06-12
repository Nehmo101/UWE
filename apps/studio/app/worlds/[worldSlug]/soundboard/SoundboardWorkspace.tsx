"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  linkedPageTitles: string[];
}

interface SpotifyConnectionStatus {
  configured: boolean;
  connected: boolean;
  expiresAt: number | null;
  scope: string | null;
}

interface Props {
  buttons: SoundboardButtonView[];
  /** Path for OAuth return redirect, e.g. /worlds/terra/soundboard */
  spotifyReturnPath?: string;
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

export function SoundboardWorkspace({ buttons, spotifyReturnPath = "/" }: Props) {
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
      const response = await fetch("/api/spotify/status");
      const payload = (await response.json()) as { status: SpotifyConnectionStatus };
      setSpotifyStatus(payload.status);
    } catch {
      setSpotifyStatus({ configured: false, connected: false, expiresAt: null, scope: null });
    }
  }, []);

  useEffect(() => {
    if (hasSpotifyButtons) {
      void refreshSpotifyStatus();
    }
  }, [hasSpotifyButtons, refreshSpotifyStatus]);

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

      let result: { ok: boolean; message: string };

      if (action === "play") {
        if (!sound.sourceUrl) {
          setSpotifyError(sound.instanceId, "Spotify-URL fehlt.");
          return false;
        }
        result = await callSpotifyApi("/api/spotify/play", {
          uri: sound.sourceUrl,
          volume: sound.volume,
        });
      } else if (action === "pause") {
        result = await callSpotifyApi("/api/spotify/pause");
      } else if (action === "resume") {
        result = await callSpotifyApi("/api/spotify/resume");
      } else if (action === "stop") {
        result = await callSpotifyApi("/api/spotify/stop");
      } else {
        result = await callSpotifyApi("/api/spotify/volume", { volume: sound.volume });
      }

      if (!result.ok) {
        setSpotifyError(sound.instanceId, result.message);
        return false;
      }

      setSpotifyError(sound.instanceId, null);
      return true;
    },
    [setSpotifyError],
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

  const syncAudioElement = useCallback((sound: ActiveSound) => {
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
  }, [buttons]);

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
    if (button.sourceType === "spotify" && !spotifyStatus?.connected) {
      window.alert(
        "Spotify ist nicht verbunden. Bitte zuerst mit Spotify verbinden (Premium + aktives Gerät erforderlich).",
      );
      return;
    }

    let nextSound: ActiveSound | null = null;

    setActiveSounds((prev) => {
      const result = playSound({ sounds: prev }, {
        id: button.id,
        title: button.title,
        sourceType: button.sourceType,
        sourceUrl: button.sourceUrl,
        assetId: button.assetId,
        volume: button.volume,
        loop: button.loop,
      });
      nextSound = result.sound;
      return result.state.sounds;
    });

    if (nextSound && button.sourceType === "spotify") {
      const ok = await syncSpotifyPlayback(nextSound, "play");
      if (!ok) {
        setActiveSounds((prev) => stopSound({ sounds: prev }, nextSound!.instanceId).sounds);
      }
    }
  };

  const handlePause = async (sound: ActiveSound) => {
    if (sound.sourceType === "spotify") {
      const ok = await syncSpotifyPlayback(sound, "pause");
      if (!ok) return;
    }
    setActiveSounds((prev) => pauseSound({ sounds: prev }, sound.instanceId).sounds);
  };

  const handleResume = async (sound: ActiveSound) => {
    if (sound.sourceType === "spotify") {
      const ok = await syncSpotifyPlayback(sound, "resume");
      if (!ok) return;
    }
    setActiveSounds((prev) => resumeSound({ sounds: prev }, sound.instanceId).sounds);
  };

  const handleStop = async (sound: ActiveSound) => {
    if (sound.sourceType === "spotify") {
      await syncSpotifyPlayback(sound, "stop");
    }
    setActiveSounds((prev) => stopSound({ sounds: prev }, sound.instanceId).sounds);
  };

  const handleVolume = async (sound: ActiveSound, volume: number) => {
    const updatedSound = { ...sound, volume };
    setActiveSounds((prev) => setSoundVolume({ sounds: prev }, sound.instanceId, volume).sounds);

    if (sound.sourceType === "spotify" && sound.status === "playing") {
      await syncSpotifyPlayback(updatedSound, "volume");
    }
  };

  const handleStopAll = async () => {
    const spotifySounds = activeSounds.filter((sound) => sound.sourceType === "spotify");
    for (const sound of spotifySounds) {
      await syncSpotifyPlayback(sound, "stop");
    }
    setActiveSounds(stopAllSounds().sounds);
  };

  const spotifyAuthHref = `/api/spotify/auth?returnTo=${encodeURIComponent(spotifyReturnPath)}`;

  return (
    <div className="uwe-soundboard">
      {hasSpotifyButtons && (
        <section className="uwe-panel" style={{ marginBottom: "1rem" }}>
          <h2>Spotify</h2>
          {!spotifyStatus?.configured && (
            <p className="uwe-table-sub">
              Spotify OAuth ist nicht konfiguriert —{" "}
              <code>SPOTIFY_CLIENT_ID</code> und <code>SPOTIFY_CLIENT_SECRET</code> in{" "}
              <code>.env</code> setzen.
            </p>
          )}
          {spotifyStatus?.configured && !spotifyStatus.connected && (
            <>
              <p className="uwe-table-sub">
                Spotify-Wiedergabe benötigt Premium, OAuth und ein aktives Spotify Connect-Gerät.
              </p>
              <a className="uwe-btn" href={spotifyAuthHref}>
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
                {sound.sourceType === "spotify" && spotifyErrors[sound.instanceId] && (
                  <p className="uwe-flash uwe-flash-error" role="alert">
                    {spotifyErrors[sound.instanceId]}
                  </p>
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
            {button.linkedPageTitles.length > 0 && (
              <span className="uwe-table-sub">↗ {button.linkedPageTitles.join(", ")}</span>
            )}
          </button>
        ))}
      </div>

      {filteredButtons.length === 0 && (
        <p className="uwe-empty">Keine Soundboard-Buttons für diesen Filter.</p>
      )}
    </div>
  );
}
