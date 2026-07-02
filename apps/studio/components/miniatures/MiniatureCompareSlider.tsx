"use client";

import { useState } from "react";

interface Props {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel: string;
  afterLabel: string;
}

/**
 * Vorher/Nachher-Fotovergleich ohne externe Dependency:
 * Beide Fotos liegen deckungsgleich übereinander, das "Nachher"-Foto wird per
 * clip-path auf den linken Anteil beschnitten. Ein transparenter, flächiger
 * Range-Input liefert Maus-, Touch- und Tastatursteuerung nativ mit.
 */
export function MiniatureCompareSlider({ beforeSrc, afterSrc, beforeLabel, afterLabel }: Props) {
  const [position, setPosition] = useState(50);

  return (
    <div className="uwe-miniature-compare-slider">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        className="uwe-miniature-compare-slider-range"
        aria-label={`Fotovergleich: ${beforeLabel} gegen ${afterLabel}`}
        aria-valuetext={`${position}% ${afterLabel}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="uwe-miniature-compare-slider-img"
        src={beforeSrc}
        alt={beforeLabel}
        draggable={false}
      />
      <div
        className="uwe-miniature-compare-slider-after"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="uwe-miniature-compare-slider-img"
          src={afterSrc}
          alt=""
          draggable={false}
        />
      </div>
      <div
        className="uwe-miniature-compare-slider-divider"
        style={{ left: `${position}%` }}
        aria-hidden
      >
        <span className="uwe-miniature-compare-slider-handle">⇄</span>
      </div>
      <span className="uwe-miniature-compare-slider-badge" data-side="after" aria-hidden>
        {afterLabel}
      </span>
      <span className="uwe-miniature-compare-slider-badge" data-side="before" aria-hidden>
        {beforeLabel}
      </span>
    </div>
  );
}
