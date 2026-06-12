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

interface Props {
  buttons: SoundboardButtonView[];
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

export function SoundboardWorkspace({ buttons }: Props) {
  const [activeSounds, setActiveSounds] = useState<ActiveSound[]>([]);
  const [tagFilter, setTagFilter] = useState<string>("");
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

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

  const handlePlay = (button: SoundboardButtonView) => {
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
      return result.state.sounds;
    });
  };

  const handlePause = (instanceId: string) => {
    setActiveSounds((prev) => pauseSound({ sounds: prev }, instanceId).sounds);
  };

  const handleResume = (instanceId: string) => {
    setActiveSounds((prev) => resumeSound({ sounds: prev }, instanceId).sounds);
  };

  const handleStop = (instanceId: string) => {
    setActiveSounds((prev) => stopSound({ sounds: prev }, instanceId).sounds);
  };

  const handleVolume = (instanceId: string, volume: number) => {
    setActiveSounds((prev) => setSoundVolume({ sounds: prev }, instanceId, volume).sounds);
  };

  const handleStopAll = () => {
    setActiveSounds(stopAllSounds().sounds);
  };

  return (
    <div className="uwe-soundboard">
      <section className="uwe-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Aktive Sounds</h2>
          {activeSounds.length > 0 && (
            <button type="button" className="uwe-btn" onClick={handleStopAll}>
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
                {sound.sourceType === "spotify" && (
                  <p className="uwe-table-sub">
                    Spotify-Wiedergabe benötigt später Premium + Web-API (OAuth vorbereitet).
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
                      handleVolume(sound.instanceId, Number(event.target.value))
                    }
                  />
                </label>
                {sound.status === "playing" ? (
                  <button type="button" className="uwe-btn" onClick={() => handlePause(sound.instanceId)}>
                    Pause
                  </button>
                ) : (
                  <button type="button" className="uwe-btn" onClick={() => handleResume(sound.instanceId)}>
                    Weiter
                  </button>
                )}
                <button type="button" className="uwe-btn" onClick={() => handleStop(sound.instanceId)}>
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
            onClick={() => handlePlay(button)}
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
