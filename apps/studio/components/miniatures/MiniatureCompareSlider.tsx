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
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted/20 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        className="absolute inset-0 z-[2] m-0 h-full w-full touch-none appearance-none p-0 opacity-0 cursor-ew-resize"
        aria-label={`Fotovergleich: ${beforeLabel} gegen ${afterLabel}`}
        aria-valuetext={`${position}% ${afterLabel}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="absolute inset-0 h-full w-full select-none object-contain pointer-events-none"
        src={beforeSrc}
        alt={beforeLabel}
        draggable={false}
      />
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="absolute inset-0 h-full w-full select-none object-contain pointer-events-none"
          src={afterSrc}
          alt=""
          draggable={false}
        />
      </div>
      <div
        className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary shadow-[0_0_0_1px] shadow-card/60 pointer-events-none"
        style={{ left: `${position}%` }}
        aria-hidden
      >
        <span className="absolute top-1/2 left-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-[0.9rem] leading-none text-primary-foreground">
          ⇄
        </span>
      </div>
      <span
        className="absolute top-2 right-2 rounded-lg bg-card/85 px-2 py-[0.15rem] text-xs text-foreground pointer-events-none"
        data-side="after"
        aria-hidden
      >
        {afterLabel}
      </span>
      <span
        className="absolute top-2 left-2 rounded-lg bg-card/85 px-2 py-[0.15rem] text-xs text-foreground pointer-events-none"
        data-side="before"
        aria-hidden
      >
        {beforeLabel}
      </span>
    </div>
  );
}
