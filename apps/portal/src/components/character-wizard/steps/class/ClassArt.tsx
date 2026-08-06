"use client";

/**
 * Das Wappen auf der Klassenkachel.
 *
 * `DndClass.art` zeigt auf `/character-creator/classes/<key>.svg`. Solange
 * dort nichts liegt, zeichnet `ClassSigil` ein aus dem Schlüssel abgeleitetes
 * Schildzeichen — deterministisch und nur mit `currentColor`, damit es in
 * jedem Thema trägt und nie eine kaputte Bildkachel entsteht.
 *
 * Steht als eigenes Modul, weil es reine Geometrie ist: rund 160 Zeilen, die
 * mit der Klassenwahl nichts zu tun haben und den Schritt sonst unter der
 * Zeilengrenze ersticken lassen (siehe CLAUDE.md § Modul-Disziplin).
 * Unterklassen benutzen dasselbe Zeichen, deshalb liegt `TileArt` hier mit.
 */

import { useState } from "react";

/**
 * Die Zahlen unten sind `viewBox`-Koordinaten, keine CSS-Maße: `.cw-tile__art`
 * skaliert die Grafik auf die Kachelbreite. Ein Vektor braucht seine Geometrie
 * im Markup — Klassen können sie nicht liefern.
 */
const ART_CENTER_X = 80;
const ART_CENTER_Y = 46;

/** Ein Schild für alle Klassen: das gemeinsame Zeichen des Schritts. */
const SHIELD_PATH =
  "M 80 15 L 105 25 L 105 47 C 105 64 93 73 80 78 C 67 73 55 64 55 47 L 55 25 Z";

/** FNV-1a, 32 Bit. Gleicher Schlüssel ⇒ gleiches Zeichen, in jeder Sitzung. */
function hashKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

interface SigilSpec {
  arms: number;
  variant: number;
  tilt: number;
}

/** Ein Merkmal, ein eigener Hash — Bitscheiben desselben Werts klumpen. */
function pick(key: string, salt: string, count: number): number {
  return hashKey(`${key}#${salt}`) % count;
}

function sigilSpec(key: string): SigilSpec {
  return {
    arms: 5 + pick(key, "arme", 4),
    variant: pick(key, "form", 3),
    tilt: pick(key, "dreh", 24) * 7.5,
  };
}

type Point = readonly [number, number];

function polar(radius: number, angle: number): Point {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [
    ART_CENTER_X + radius * Math.cos(radians),
    ART_CENTER_Y + radius * Math.sin(radians),
  ];
}

function pointsOnRing(count: number, radius: number, tilt: number): Point[] {
  return Array.from({ length: count }, (_, index) =>
    polar(radius, tilt + (360 / count) * index),
  );
}

function toPolygonPoints(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

/**
 * Ein Stern als ein oder zwei Polygonzüge: Bei ungerader Eckenzahl ergibt der
 * Zweierschritt einen echten Stern {n/2}, bei gerader zwei versetzte Vielecke
 * (Hexagramm, Oktagramm) — der Zweierschritt liefe dort im Kreis.
 */
function starRings(arms: number, radius: number, tilt: number): Point[][] {
  if (arms % 2 === 1) {
    const ring = pointsOnRing(arms, radius, tilt);
    return [Array.from({ length: arms }, (_, index) => ring[(index * 2) % arms])];
  }
  const half = arms / 2;
  return [pointsOnRing(half, radius, tilt), pointsOnRing(half, radius, tilt + 180 / half)];
}

/** Das Zeichen im Schild: Sparren, Stern oder Strahlenkranz. */
function ClassEmblem({ spec }: { spec: SigilSpec }) {
  const { arms, variant, tilt } = spec;

  if (variant === 0) {
    const rows = Array.from({ length: 3 + (arms % 3) }, (_, index) => 30 + index * 8.5);
    return (
      <>
        {rows.map((top, index) => (
          <path
            key={top}
            d={`M 68 ${top} L 80 ${top + 7} L 92 ${top}`}
            strokeOpacity={index === 0 ? "0.5" : "0.3"}
            strokeWidth="1.5"
          />
        ))}
      </>
    );
  }

  if (variant === 1) {
    return (
      <>
        {starRings(arms, 15, tilt).map((ring, index) => (
          <polygon key={index} points={toPolygonPoints(ring)} strokeOpacity="0.5" strokeWidth="1.3" />
        ))}
      </>
    );
  }

  const outer = pointsOnRing(arms * 2, 16.5, tilt);
  return (
    <>
      <circle cx={ART_CENTER_X} cy={ART_CENTER_Y} r="16.5" strokeOpacity="0.28" strokeWidth="0.9" />
      {pointsOnRing(arms * 2, 6.5, tilt).map(([x, y], index) => (
        <line
          key={index}
          x1={x.toFixed(2)}
          y1={y.toFixed(2)}
          x2={outer[index][0].toFixed(2)}
          y2={outer[index][1].toFixed(2)}
          strokeOpacity="0.42"
          strokeWidth="1.1"
        />
      ))}
    </>
  );
}

function ClassSigil({ entryKey }: { entryKey: string }) {
  const spec = sigilSpec(entryKey);

  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="5" width="150" height="80" rx="7" strokeOpacity="0.12" strokeWidth="0.9" />
        <path d="M 50 30 Q 28 34 17 49" strokeOpacity="0.16" strokeWidth="0.8" />
        <path d="M 50 38 Q 32 42 23 54" strokeOpacity="0.1" strokeWidth="0.7" />
        <path d="M 110 30 Q 132 34 143 49" strokeOpacity="0.16" strokeWidth="0.8" />
        <path d="M 110 38 Q 128 42 137 54" strokeOpacity="0.1" strokeWidth="0.7" />
        <path d={SHIELD_PATH} strokeOpacity="0.3" strokeWidth="1.1" />
        <path d={SHIELD_PATH} strokeOpacity="0.12" strokeWidth="3.5" />
        <ClassEmblem spec={spec} />
      </g>
      <circle cx={ART_CENTER_X} cy={ART_CENTER_Y} r="2.2" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

/** Bild, wenn es eines gibt — sonst das Schildzeichen. */
export function TileArt({ entryKey, src }: { entryKey: string; src?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="cw-tile__art">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <ClassSigil entryKey={entryKey} />
      )}
    </span>
  );
}
