"use client";

/**
 * Schritt 1 — das Volk.
 *
 * Der Schritt hat drei Aufgaben, in dieser Reihenfolge:
 *
 *  1. **Entscheiden lassen.** Neun Kacheln mit demselben Kennzahlen-Dreiklang
 *     an derselben Stelle (Größe, Tempo, Dunkelsicht) — nur so kann man vier
 *     Völker nebeneinander lesen. Der Regeltext steckt darunter in einer
 *     `.cw-disclosure`, nicht auf der Kachel.
 *  2. **Die Folgewahl an Ort und Stelle nachreichen.** Wer Elf wählt, braucht
 *     die Abstammung — aber keinen zweiten Schritt dafür. Sie erscheint unter
 *     dem Raster, ohne das Raster umzubauen.
 *  3. **Die Erwartung von 2014 korrigieren.** Der häufigste Satz am Tisch ist
 *     „wo sind meine +2?". Er wird hier beantwortet, nicht ausgesessen: die
 *     Attributsboni kommen seit 2024 aus dem Hintergrund, mit Sprungziel.
 *
 * Bilder: `Species.art` verweist auf `/character-creator/species/<key>.svg`.
 * Solange diese Dateien fehlen (oder eine fehlt), zeichnet `SpeciesSigil` ein
 * aus dem Schlüssel abgeleitetes Wappen — deterministisch, damit ein Volk
 * immer dasselbe Zeichen trägt, und nur mit `currentColor`, damit es in jedem
 * Thema stimmt. Eine kaputte Bildkachel gibt es dadurch nie.
 */

import { useMemo, useState } from "react";
import {
  SPECIES,
  type CreatureSize,
  type Species,
  type SpeciesLineage,
  type Trait,
} from "@uwe/character-creator";

import { Button } from "@/src/components/ui/button";
import { NavIcon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { Alert, EmptyState } from "@/src/components/ui/states";
import type { StepProps } from "../types";

// ───────────────────────────── Beschriftungen ─────────────────────────────

const SIZE_LABELS: Record<CreatureSize, string> = {
  tiny: "Winzig",
  small: "Klein",
  medium: "Mittelgroß",
  large: "Groß",
};

function sizeLabel(species: Species): string {
  const choices = species.sizeChoice;
  if (!choices || choices.length < 2) return SIZE_LABELS[species.size];
  return choices.map((size) => SIZE_LABELS[size]).join(" oder ");
}

// ─────────────────────────── Wappen aus dem Schlüssel ───────────────────────────

/**
 * Die Zahlen in diesem Abschnitt sind Koordinaten im `viewBox` des Wappens,
 * keine CSS-Maße: Die Grafik wird von `.cw-tile__art` auf die Kachelbreite
 * skaliert. Ein Vektor braucht seine Geometrie im Markup — Klassen können sie
 * nicht liefern.
 */
const ART_CENTER_X = 80;
const ART_CENTER_Y = 45;

/** FNV-1a, 32 Bit. Gleicher Schlüssel ⇒ gleiches Wappen, in jeder Sitzung. */
function hashKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

interface SigilSpec {
  /** Zahl der Strahlen/Ecken — 5 bis 8. */
  arms: number;
  /** Welches der drei Innenzeichen. */
  variant: number;
  /** Drehung des Zeichens in Grad. */
  tilt: number;
  /** Verhältnis von innerem zu äußerem Vieleck. */
  innerRatio: number;
}

function sigilSpec(key: string): SigilSpec {
  const hash = hashKey(key);
  return {
    arms: 5 + (hash % 4),
    variant: (hash >>> 4) % 3,
    tilt: ((hash >>> 8) % 24) * 7.5,
    innerRatio: 0.4 + ((hash >>> 13) % 5) * 0.07,
  };
}

type Point = readonly [number, number];

/** Punkt auf einem Kreis um die Mitte; 0° zeigt nach oben. */
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

/** Das Innenzeichen: Sternpolygon, Rosette oder Mandala. */
function SpeciesEmblem({ spec }: { spec: SigilSpec }) {
  const { arms, variant, tilt, innerRatio } = spec;
  const radius = 21;

  if (variant === 0) {
    const ring = pointsOnRing(arms, radius, tilt);
    if (arms % 2 === 1) {
      // Ungerade Eckenzahl trägt einen echten Stern {n/2}.
      const order = Array.from({ length: arms }, (_, index) => (index * 2) % arms);
      return (
        <polygon
          points={toPolygonPoints(order.map((index) => ring[index]))}
          strokeOpacity="0.5"
          strokeWidth="1.4"
        />
      );
    }
    // Gerade Eckenzahl: zwei versetzte Vielecke — Hexagramm, Oktagramm.
    const half = arms / 2;
    return (
      <>
        <polygon
          points={toPolygonPoints(pointsOnRing(half, radius, tilt))}
          strokeOpacity="0.5"
          strokeWidth="1.4"
        />
        <polygon
          points={toPolygonPoints(pointsOnRing(half, radius, tilt + 180 / half))}
          strokeOpacity="0.5"
          strokeWidth="1.4"
        />
      </>
    );
  }

  if (variant === 1) {
    // Blütenrosette: Kreise, die alle durch die Mitte laufen.
    const petal = radius * 0.52;
    return (
      <>
        {pointsOnRing(arms, petal, tilt).map(([x, y], index) => (
          <circle
            key={index}
            cx={x.toFixed(2)}
            cy={y.toFixed(2)}
            r={petal.toFixed(2)}
            strokeOpacity="0.38"
            strokeWidth="1"
          />
        ))}
      </>
    );
  }

  const outer = pointsOnRing(arms, radius, tilt);
  const inner = pointsOnRing(arms, radius * innerRatio, tilt + 180 / arms);
  return (
    <>
      <polygon points={toPolygonPoints(outer)} strokeOpacity="0.42" strokeWidth="1.2" />
      <polygon points={toPolygonPoints(inner)} strokeOpacity="0.28" strokeWidth="1" />
      {outer.map(([x, y], index) => (
        <line
          key={index}
          x1={ART_CENTER_X}
          y1={ART_CENTER_Y}
          x2={x.toFixed(2)}
          y2={y.toFixed(2)}
          strokeOpacity="0.16"
          strokeWidth="0.7"
        />
      ))}
    </>
  );
}

/** Das ganze Wappen: Rahmen, Strahlenkranz, Ringe, Innenzeichen. */
function SpeciesSigil({ entryKey }: { entryKey: string }) {
  const spec = sigilSpec(entryKey);
  const inner = pointsOnRing(spec.arms * 2, 30, spec.tilt);
  const outer = pointsOnRing(spec.arms * 2, 34.5, spec.tilt);

  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="5" width="150" height="80" rx="7" strokeOpacity="0.12" strokeWidth="0.9" />
        <path d="M 12 45 H 44" strokeOpacity="0.16" strokeWidth="0.8" />
        <path d="M 116 45 H 148" strokeOpacity="0.16" strokeWidth="0.8" />
        <path d="M 12 41 L 16 45 L 12 49 L 8 45 Z" strokeOpacity="0.2" strokeWidth="0.8" />
        <path d="M 148 41 L 152 45 L 148 49 L 144 45 Z" strokeOpacity="0.2" strokeWidth="0.8" />
        {inner.map(([x, y], index) => (
          <line
            key={index}
            x1={x.toFixed(2)}
            y1={y.toFixed(2)}
            x2={outer[index][0].toFixed(2)}
            y2={outer[index][1].toFixed(2)}
            strokeOpacity="0.18"
            strokeWidth="0.7"
          />
        ))}
        <circle cx={ART_CENTER_X} cy={ART_CENTER_Y} r="28" strokeOpacity="0.26" strokeWidth="0.9" />
        <circle cx={ART_CENTER_X} cy={ART_CENTER_Y} r="25" strokeOpacity="0.12" strokeWidth="0.6" />
        <SpeciesEmblem spec={spec} />
        <circle cx={ART_CENTER_X} cy={ART_CENTER_Y} r="5.5" strokeOpacity="0.3" strokeWidth="0.8" />
      </g>
      <circle cx={ART_CENTER_X} cy={ART_CENTER_Y} r="2.4" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

/**
 * Bild, wenn es eines gibt — sonst das Wappen.
 *
 * Der Tausch passiert im `onError`, damit die Kachel auch dann etwas zeigt,
 * wenn die Datei erst später geliefert wird oder einzeln fehlt.
 */
function TileArt({ entryKey, src }: { entryKey: string; src?: string }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <span className="cw-tile__art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" onError={() => setFailed(true)} />
      </span>
    );
  }

  return (
    <span className="cw-tile__art">
      <SpeciesSigil entryKey={entryKey} />
    </span>
  );
}

// ───────────────────────────── Suche und Filter ─────────────────────────────

interface SpeciesFilter {
  key: string;
  label: string;
  matches: (species: Species) => boolean;
}

const SPECIES_FILTERS: SpeciesFilter[] = [
  {
    key: "dunkelsicht",
    label: "Sieht im Dunkeln",
    matches: (species) => species.darkvision !== null,
  },
  {
    key: "abstammung",
    label: "Mit Abstammung",
    matches: (species) => (species.lineages?.length ?? 0) > 0,
  },
  {
    key: "klein",
    label: "Klein möglich",
    matches: (species) =>
      species.size === "small" || (species.sizeChoice?.includes("small") ?? false),
  },
  {
    key: "schnell",
    label: "Schneller als 30 Fuß",
    matches: (species) => species.speed > 30,
  },
];

/** Suchtext je Volk, einmal beim Laden gebaut — der Katalog ändert sich nicht. */
const HAYSTACKS = new Map<string, string>(
  SPECIES.map((species) => [
    species.key,
    [
      species.name,
      species.nameEn,
      species.hook,
      ...species.traits.map((trait) => trait.name),
      ...(species.lineages ?? []).flatMap((lineage) => [lineage.name, lineage.nameEn]),
    ]
      .join(" ")
      .toLowerCase(),
  ]),
);

/** Ab neun Einträgen wird gesucht und gefiltert — darunter genügt das Raster. */
const SEARCHABLE = SPECIES.length > 8;

// ───────────────────────────── Kacheln ─────────────────────────────

function SpeciesTile({
  species,
  selected,
  onSelect,
}: {
  species: Species;
  selected: boolean;
  onSelect: (species: Species) => void;
}) {
  const lineageCount = species.lineages?.length ?? 0;

  return (
    <button
      type="button"
      className="cw-tile"
      aria-pressed={selected}
      onClick={() => onSelect(species)}
    >
      <span className="cw-tile__check" aria-hidden="true">
        <NavIcon name="check" width={16} height={16} />
      </span>
      <TileArt entryKey={species.key} src={species.art} />
      <span className="cw-tile__name">{species.name}</span>
      <span className="cw-tile__hook">{species.hook}</span>
      <span className="cw-tile__meta">
        <span className="cw-chip">
          Größe <span className="cw-chip__value">{sizeLabel(species)}</span>
        </span>
        <span className="cw-chip">
          Tempo <span className="cw-chip__value">{species.speed}</span> Fuß
        </span>
        <span className="cw-chip">
          {species.darkvision === null ? (
            "Keine Dunkelsicht"
          ) : (
            <>
              Dunkelsicht <span className="cw-chip__value">{species.darkvision}</span> Fuß
            </>
          )}
        </span>
        {lineageCount > 0 ? (
          <span className="cw-chip" data-tone="accent">
            {species.lineageLabel ?? "Abstammung"}:{" "}
            <span className="cw-chip__value">{lineageCount}</span> zur Wahl
          </span>
        ) : null}
      </span>
    </button>
  );
}

function LineageTile({
  lineage,
  fallbackSpeed,
  selected,
  onSelect,
}: {
  lineage: SpeciesLineage;
  fallbackSpeed: number;
  selected: boolean;
  onSelect: (lineage: SpeciesLineage) => void;
}) {
  return (
    <button
      type="button"
      className="cw-tile"
      aria-pressed={selected}
      onClick={() => onSelect(lineage)}
    >
      <span className="cw-tile__check" aria-hidden="true">
        <NavIcon name="check" width={16} height={16} />
      </span>
      <TileArt entryKey={lineage.key} />
      <span className="cw-tile__name">{lineage.name}</span>
      <span className="cw-tile__hook">{lineage.hook}</span>
      <span className="cw-tile__meta">
        {lineage.darkvision !== undefined && lineage.darkvision !== null ? (
          <span className="cw-chip" data-tone="accent">
            Dunkelsicht <span className="cw-chip__value">{lineage.darkvision}</span> Fuß
          </span>
        ) : null}
        {lineage.speed !== undefined && lineage.speed !== fallbackSpeed ? (
          <span className="cw-chip" data-tone="accent">
            Tempo <span className="cw-chip__value">{lineage.speed}</span> Fuß
          </span>
        ) : null}
        {lineage.traits.slice(0, 3).map((trait) => (
          <span key={trait.name} className="cw-chip">
            {trait.name}
            {trait.level && trait.level > 1 ? (
              <>
                {" "}
                <span className="cw-chip__value">ab {trait.level}</span>
              </>
            ) : null}
          </span>
        ))}
      </span>
    </button>
  );
}

// ───────────────────────────── Regeltext ─────────────────────────────

function TraitList({ traits }: { traits: readonly Trait[] }) {
  return (
    <ul>
      {traits.map((trait) => (
        <li key={trait.name}>
          <strong>{trait.name}</strong>
          {trait.level && trait.level > 1 ? ` (ab Stufe ${trait.level})` : ""} —{" "}
          {trait.description}
        </li>
      ))}
    </ul>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split("\n\n").map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </>
  );
}

// ───────────────────────────── Der Schritt ─────────────────────────────

export function SpeciesStep({ draft, patch, set, resolved, validation, goTo }: StepProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<string[]>([]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SPECIES.filter((species) => {
      if (needle && !(HAYSTACKS.get(species.key) ?? "").includes(needle)) return false;
      return SPECIES_FILTERS.every(
        (filter) => !filters.includes(filter.key) || filter.matches(species),
      );
    });
  }, [query, filters]);

  const species = resolved.species;
  const lineages = species?.lineages ?? [];
  const lineageLabel = species?.lineageLabel ?? "Abstammung";
  const lineageMissing = lineages.length > 0 && !draft.lineageKey;

  function toggleFilter(key: string) {
    setFilters((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );
  }

  function resetSearch() {
    setQuery("");
    setFilters([]);
  }

  /** Ein Volkswechsel macht die Abstammung ungültig — beides in einem Zug. */
  function chooseSpecies(next: Species) {
    if (draft.speciesKey === next.key) return;
    patch({ speciesKey: next.key, lineageKey: null });
  }

  return (
    <>
      <Alert icon="info" title="Völker geben seit 2024 keine Attributsboni mehr">
        Wer aus den älteren Regeln kommt, sucht hier die +2/+1 — sie sind zum
        Hintergrund gewandert. Dein Volk bestimmt Größe, Tempo, Sinne und Merkmale;
        die Zahlen kommen im Schritt „Hintergrund".{" "}
        <Button variant="link" onClick={() => goTo("background")}>
          Hintergrund ansehen
        </Button>
      </Alert>

      <h3 id="cw-species-heading">Volk wählen</h3>

      {SEARCHABLE ? (
        <div className="cw-search">
          <label htmlFor="cw-species-search">Suchen</label>
          <Input
            id="cw-species-search"
            type="search"
            value={query}
            placeholder="Name, Merkmal oder Abstammung"
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="cw-filters" role="group" aria-label="Völker filtern">
            <button
              type="button"
              className="cw-filter"
              aria-pressed={filters.length === 0}
              onClick={() => setFilters([])}
            >
              Alle
            </button>
            {SPECIES_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className="cw-filter"
                aria-pressed={filters.includes(filter.key)}
                onClick={() => toggleFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </span>
        </div>
      ) : null}

      <p className="cw-prose" aria-live="polite">
        {visible.length === SPECIES.length
          ? `${SPECIES.length} Völker stehen zur Wahl.`
          : visible.length === 1
            ? `Ein Volk von ${SPECIES.length} passt.`
            : `${visible.length} von ${SPECIES.length} Völkern passen.`}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon="search-x"
          title="Kein Volk passt zu dieser Suche."
          description="Der Katalog hat neun Völker — vermutlich ist ein Filter zu eng gesetzt oder im Suchfeld steht ein Tippfehler."
          action={
            <Button variant="outline" onClick={resetSearch}>
              Suche und Filter zurücksetzen
            </Button>
          }
        />
      ) : (
        <div className="cw-grid" role="group" aria-labelledby="cw-species-heading">
          {visible.map((entry) => (
            <SpeciesTile
              key={entry.key}
              species={entry}
              selected={draft.speciesKey === entry.key}
              onSelect={chooseSpecies}
            />
          ))}
        </div>
      )}

      {species && lineages.length > 0 ? (
        <section>
          <h3 id="cw-lineage-heading">
            {lineageLabel} — die zweite Hälfte deiner Herkunft
          </h3>
          <p className="cw-prose">
            {lineageMissing
              ? (validation.issues[0] ??
                `${species.name} verlangt noch eine Wahl: ${lineageLabel}.`)
              : `Deine Wahl für ${species.name}. Sie lässt sich jederzeit tauschen.`}
          </p>

          <div className="cw-grid" role="group" aria-labelledby="cw-lineage-heading">
            {lineages.map((lineage) => (
              <LineageTile
                key={lineage.key}
                lineage={lineage}
                fallbackSpeed={species.speed}
                selected={draft.lineageKey === lineage.key}
                onSelect={(next) => set("lineageKey", next.key)}
              />
            ))}
          </div>

          {resolved.lineage ? (
            <details className="cw-disclosure">
              <summary>{resolved.lineage.name} — voller Regeltext</summary>
              <div className="cw-prose">
                <Paragraphs text={resolved.lineage.description} />
                <TraitList traits={resolved.lineage.traits} />
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {visible.length > 0 ? (
        <section>
          <h3>Merkmale nachschlagen</h3>
          <p className="cw-prose">
            Die Kachel trägt die Entscheidung, hier steht das Kleingedruckte — je
            ein Aufklapper pro angezeigtem Volk.
          </p>
          {visible.map((entry) => (
            <details className="cw-disclosure" key={entry.key}>
              <summary>
                {entry.name} — alle Merkmale
                {draft.speciesKey === entry.key ? " · deine Wahl" : ""}
              </summary>
              <div className="cw-prose">
                <Paragraphs text={entry.description} />
                <TraitList traits={entry.traits} />
                {entry.lineages?.length ? (
                  <p>
                    {entry.lineageLabel ?? "Abstammung"} zur Wahl:{" "}
                    {entry.lineages.map((lineage) => lineage.name).join(", ")}.
                  </p>
                ) : null}
                <p>
                  Quelle: {entry.source.book} ({entry.source.license}), englischer
                  Name: {entry.nameEn}.
                </p>
              </div>
            </details>
          ))}
        </section>
      ) : null}
    </>
  );
}
