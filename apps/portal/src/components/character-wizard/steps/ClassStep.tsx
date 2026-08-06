"use client";

/**
 * Schritt 2 — die Klasse.
 *
 * Zwölf Kacheln sind die dichteste Stelle des Erstellers. Damit sie lesbar
 * bleibt, liegt auf jeder Kachel dieselbe Kennzahlenreihe in derselben
 * Reihenfolge: Trefferwürfel, Primärattribut, Rettungswürfe, Anspruch. Erst
 * danach kommen drei Rollenschlagworte und zuletzt die Empfehlungsmarken.
 *
 * Drei Entscheidungshilfen sind hier eingebaut: „Gut für den Anfang“ auf
 * allen Klassen mit `complexity === 1`; die Passung zu bereits verteilten
 * Attributen, weil der Ersteller ausdrücklich erlaubt, zuerst zu würfeln; und
 * die Ansage, wann die Unterklasse fällt — im SRD 2024 auf Stufe 3, also
 * nicht jetzt. Was dort zur Wahl steht, lässt sich trotzdem nachlesen.
 *
 * Bilder: `DndClass.art` zeigt auf `/character-creator/classes/<key>.svg`.
 * Fehlt die Datei, zeichnet `ClassSigil` ein aus dem Schlüssel abgeleitetes
 * Schildzeichen — deterministisch und nur mit `currentColor`, damit es in
 * jedem Thema trägt und nie eine kaputte Bildkachel entsteht.
 */

import { useMemo, useState } from "react";
import {
  ABILITIES,
  ABILITY_LABELS,
  ABILITY_SHORT,
  CLASSES,
  type AbilityKey,
  type AbilityScoreMap,
  type DndClass,
  type Subclass,
  type Trait,
} from "@uwe/character-creator";

import { Button } from "@/src/components/ui/button";
import { NavIcon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { Alert, EmptyState } from "@/src/components/ui/states";
import type { StepProps } from "../types";

// ───────────────────────────── Beschriftungen ─────────────────────────────

const COMPLEXITY_LABELS: Record<1 | 2 | 3, string> = {
  1: "Einstieg",
  2: "Mittel",
  3: "Anspruchsvoll",
};

/** Punkte statt Balken — Farbe trägt die Information hier nie allein. */
const COMPLEXITY_DOTS: Record<1 | 2 | 3, string> = {
  1: "●○○",
  2: "●●○",
  3: "●●●",
};

const PROGRESSION_LABELS: Record<string, string> = {
  full: "volle Zauberei",
  half: "halbe Zauberei",
  third: "Zauberei ab Stufe 3",
  pact: "Paktmagie",
  none: "keine Zauberei",
};

function shortList(abilities: readonly AbilityKey[]): string {
  return abilities.map((ability) => ABILITY_SHORT[ability]).join(" · ");
}

/** „A, B und C" statt „A und B und C" — die Empfehlung nennt bis zu vier. */
function enumerate(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
}

function longList(abilities: readonly AbilityKey[]): string {
  return enumerate(abilities.map((ability) => ABILITY_LABELS[ability]));
}

// ─────────────────────────── Wappen aus dem Schlüssel ───────────────────────────

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
function TileArt({ entryKey, src }: { entryKey: string; src?: string }) {
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

// ─────────────────── Passung zu bereits verteilten Attributen ───────────────────

/**
 * Die Attribute, auf denen der Charakter steht: alles, was nicht schlechter
 * ist als der zweitbeste Wert — mindestens zwei, bei Gleichstand mehr. Ein
 * starrer Schwellenwert („ab 14“) wäre beim Punktekauf zu großzügig und nach
 * einem schlechten Wurf zu streng.
 */
function highAbilities(scores: AbilityScoreMap): AbilityKey[] {
  const sorted = [...ABILITIES].sort((left, right) => scores[right] - scores[left]);
  const cutoff = scores[sorted[1]];
  return ABILITIES.filter((ability) => scores[ability] >= cutoff);
}

type Fit = "none" | "partial" | "full";

function classFit(dndClass: DndClass, high: readonly AbilityKey[] | null): Fit {
  if (!high) return "none";
  const hits = dndClass.primaryAbilities.filter((ability) => high.includes(ability));
  if (hits.length === 0) return "none";
  return hits.length === dndClass.primaryAbilities.length ? "full" : "partial";
}

// ───────────────────────────── Suche und Filter ─────────────────────────────

interface ClassFilter {
  key: string;
  label: string;
  matches: (dndClass: DndClass) => boolean;
}

const CLASS_FILTERS: ClassFilter[] = [
  {
    key: "einstieg",
    label: "Gut für den Anfang",
    matches: (dndClass) => dndClass.complexity === 1,
  },
  { key: "zaubert", label: "Zaubert", matches: (dndClass) => dndClass.spellcasting !== null },
  {
    key: "nahkampf",
    label: "Nahkampf",
    matches: (dndClass) => dndClass.roleTags.includes("Nahkampf"),
  },
  {
    key: "fernkampf",
    label: "Fernkampf",
    matches: (dndClass) => dndClass.roleTags.includes("Fernkampf"),
  },
  {
    key: "heilung",
    label: "Heilung",
    matches: (dndClass) => dndClass.roleTags.includes("Heilung"),
  },
];

/** Schlüssel des Filters, der nur mit verteilten Attributen etwas tut. */
const FIT_FILTER = "passt";

/** Suchtext je Klasse, einmal beim Laden gebaut — der Katalog ändert sich nicht. */
const HAYSTACKS = new Map<string, string>(
  CLASSES.map((entry) => [
    entry.key,
    [
      entry.name, entry.nameEn, entry.hook, entry.subclassLabel, ...entry.roleTags,
      ...entry.features.map((feature) => feature.name),
      ...entry.subclasses.map((subclass) => subclass.name),
    ].join(" ").toLowerCase(),
  ]),
);

/** Ab neun Einträgen wird gesucht und gefiltert — zwölf sind deutlich mehr. */
const SEARCHABLE = CLASSES.length > 8;

// ───────────────────────────── Kacheln ─────────────────────────────

function FilterPill({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="cw-filter" aria-pressed={active} onClick={onToggle}>
      {label}
    </button>
  );
}

function ClassTile({
  dndClass,
  fit,
  selected,
  onSelect,
}: {
  dndClass: DndClass;
  fit: Fit;
  selected: boolean;
  onSelect: (dndClass: DndClass) => void;
}) {
  return (
    <button type="button" className="cw-tile" aria-pressed={selected} onClick={() => onSelect(dndClass)}>
      <span className="cw-tile__check" aria-hidden="true">
        <NavIcon name="check" width={16} height={16} />
      </span>
      <TileArt entryKey={dndClass.key} src={dndClass.art} />
      <span className="cw-tile__name">{dndClass.name}</span>
      <span className="cw-tile__hook">{dndClass.hook}</span>
      <span className="cw-tile__meta">
        <span className="cw-chip">
          Trefferwürfel <span className="cw-chip__value">W{dndClass.hitDie}</span>
        </span>
        <span className="cw-chip">
          Primär <span className="cw-chip__value">{shortList(dndClass.primaryAbilities)}</span>
        </span>
        <span className="cw-chip">
          Rettung <span className="cw-chip__value">{shortList(dndClass.savingThrows)}</span>
        </span>
        <span className="cw-chip">
          {COMPLEXITY_LABELS[dndClass.complexity]}{" "}
          <span className="cw-chip__value" aria-hidden="true">{COMPLEXITY_DOTS[dndClass.complexity]}</span>
        </span>
        {dndClass.roleTags.slice(0, 3).map((tag) => (
          <span key={tag} className="cw-chip">{tag}</span>
        ))}
        {dndClass.complexity === 1 ? (
          <span className="cw-chip" data-tone="accent">Gut für den Anfang</span>
        ) : null}
        {fit !== "none" ? (
          <span className="cw-chip" data-tone="accent">
            {fit === "full" ? "Passt genau zu deinen Werten" : "Passt zu deinen Werten"}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function SubclassTile({
  subclass,
  selected,
  onSelect,
}: {
  subclass: Subclass;
  selected: boolean;
  onSelect: (subclass: Subclass) => void;
}) {
  return (
    <button type="button" className="cw-tile" aria-pressed={selected} onClick={() => onSelect(subclass)}>
      <span className="cw-tile__check" aria-hidden="true">
        <NavIcon name="check" width={16} height={16} />
      </span>
      <TileArt entryKey={subclass.key} />
      <span className="cw-tile__name">{subclass.name}</span>
      <span className="cw-tile__hook">{subclass.hook}</span>
      <span className="cw-tile__meta">
        {subclass.features.slice(0, 3).map((feature) => (
          <span key={feature.name} className="cw-chip">{feature.name}</span>
        ))}
      </span>
    </button>
  );
}

// ───────────────────────────── Regeltext ─────────────────────────────

function FeatureList({ features }: { features: readonly Trait[] }) {
  return (
    <ul>
      {features.map((feature) => (
        <li key={feature.name}>
          <strong>{feature.name}</strong>
          {feature.level && feature.level > 1 ? ` (ab Stufe ${feature.level})` : ""} —{" "}
          {feature.description}
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

/** Wann die Unterklasse fällt — die häufigste Rückfrage in diesem Schritt. */
function subclassNote(dndClass: DndClass, now: boolean): string {
  if (now) {
    return `${dndClass.name} legt ${dndClass.subclassLabel} schon auf Stufe ${dndClass.subclassLevel} fest — also jetzt.`;
  }
  return (
    `${dndClass.name} entscheidet ${dndClass.subclassLabel} nicht bei der Erstellung, sondern beim ` +
    `Aufstieg auf Stufe ${dndClass.subclassLevel}. Dieser Schritt fragt sie deshalb nicht ab — was ` +
    `dann zur Wahl steht, kannst du hier trotzdem schon nachlesen.`
  );
}

/** Die Zauberzeile als ein Satz — sie hat zu viele Fälle für lesbares JSX. */
function spellcastingSentence(dndClass: DndClass): string {
  const cast = dndClass.spellcasting;
  if (!cast) return "Zauberei: keine — diese Klasse kommt ohne Zauberliste aus.";
  const progression = PROGRESSION_LABELS[cast.progression] ?? cast.progression;
  const preparation = cast.preparation === "prepared" ? "täglich neu vorbereitet" : "fest gewählt";
  return (
    `Zauberei: ${progression}, Zauberattribut ${ABILITY_LABELS[cast.ability]}, ${preparation}. ` +
    `Auf Stufe 1: ${cast.cantripsKnown} Zaubertricks und ${cast.spellsKnownAtFirst} Zauber des 1. Grades.`
  );
}

function ClassRules({ dndClass }: { dndClass: DndClass }) {
  const levelOne = dndClass.features.filter((feature) => (feature.level ?? 1) <= 1);
  const tools = dndClass.toolProficiencies;

  return (
    <div className="cw-prose">
      <Paragraphs text={dndClass.description} />
      <p><strong>Merkmale auf Stufe 1</strong></p>
      <FeatureList features={levelOne} />
      <p>
        Rüstung: {dndClass.armorProficiencies.join(", ") || "keine"}. Waffen:{" "}
        {dndClass.weaponProficiencies.join(", ") || "keine"}.
        {tools.length > 0 ? ` Werkzeuge: ${tools.join(", ")}.` : ""} Fertigkeiten:{" "}
        {dndClass.skills.choose} zur Wahl
        {dndClass.skills.from.length === 0 ? " aus allen achtzehn" : ""}. Rettungswürfe:{" "}
        {longList(dndClass.savingThrows)}. Primärattribut:{" "}
        {longList(dndClass.primaryAbilities)}.
      </p>
      <p>{spellcastingSentence(dndClass)}</p>
      <p>
        {dndClass.subclassLabel} ab Stufe {dndClass.subclassLevel}:{" "}
        {dndClass.subclasses.map((subclass) => subclass.name).join(", ")}. Quelle:{" "}
        {dndClass.source.book} ({dndClass.source.license}), englischer Name:{" "}
        {dndClass.nameEn}.
      </p>
    </div>
  );
}

// ───────────────────────────── Der Schritt ─────────────────────────────

export function ClassStep({ draft, patch, set, resolved, preview, goTo }: StepProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<string[]>([]);

  const abilitiesKnown = draft.abilities !== null;
  const high = useMemo(
    () => (abilitiesKnown ? highAbilities(preview.scores) : null),
    [abilitiesKnown, preview.scores],
  );

  const recommended = useMemo(
    () => (high ? CLASSES.filter((entry) => classFit(entry, high) !== "none") : []),
    [high],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CLASSES.filter((dndClass) => {
      if (needle && !(HAYSTACKS.get(dndClass.key) ?? "").includes(needle)) return false;
      if (filters.includes(FIT_FILTER) && classFit(dndClass, high) === "none") return false;
      return CLASS_FILTERS.every(
        (filter) => !filters.includes(filter.key) || filter.matches(dndClass),
      );
    });
  }, [query, filters, high]);

  const dndClass = resolved.dndClass;
  const subclassNow = dndClass !== null && dndClass.subclassLevel <= 1;

  function toggleFilter(key: string) {
    setFilters((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );
  }

  function resetSearch() {
    setQuery("");
    setFilters([]);
  }

  /**
   * Ein Klassenwechsel entwertet alles, was aus der alten Klasse kam:
   * Unterklasse, gewählte Fertigkeiten, Startausrüstung, Zauber. Deshalb ein
   * `patch` statt eines `set` — sonst schleppt der Entwurf die Fertigkeiten
   * des Schurken in den Barbaren.
   */
  function chooseClass(next: DndClass) {
    if (draft.classKey === next.key) return;
    patch({
      classKey: next.key,
      subclassKey: null,
      chosenSkills: [],
      equipmentChoice: null,
      cantrips: [],
      spells: [],
    });
  }

  return (
    <>
      {abilitiesKnown && high ? (
        <Alert icon="sparkles" title="Deine Werte stehen schon — das schränkt sinnvoll ein">
          Am höchsten stehen {longList(high)}. Dazu passen{" "}
          {recommended.length > 0
            ? `${enumerate(recommended.map((entry) => entry.name))} — sie sind unten markiert.`
            : "keine Klasse besonders deutlich; nimm die, die dich interessiert."}{" "}
          Das ist ein Hinweis, keine Vorschrift: Eine Klasse gegen die eigenen Werte zu
          spielen ist erlaubt und manchmal die bessere Geschichte.
        </Alert>
      ) : (
        <Alert icon="dices" title="Attribute noch nicht verteilt">
          Sobald deine sechs Werte stehen, markiert dieser Schritt die Klassen, die auf
          deine hohen Werte einzahlen. Die Reihenfolge ist frei — du darfst zuerst
          würfeln.{" "}
          <Button variant="link" onClick={() => goTo("abilities")}>
            Attribute verteilen
          </Button>
        </Alert>
      )}

      <h3 id="cw-class-heading">Klasse wählen</h3>

      {SEARCHABLE ? (
        <div className="cw-search">
          <label htmlFor="cw-class-search">Suchen</label>
          <Input
            id="cw-class-search"
            type="search"
            value={query}
            placeholder="Name, Rolle oder Merkmal"
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="cw-filters" role="group" aria-label="Klassen filtern">
            <FilterPill label="Alle" active={filters.length === 0} onToggle={() => setFilters([])} />
            {CLASS_FILTERS.map((filter) => (
              <FilterPill
                key={filter.key}
                label={filter.label}
                active={filters.includes(filter.key)}
                onToggle={() => toggleFilter(filter.key)}
              />
            ))}
            {high ? (
              <FilterPill
                label="Passt zu meinen Werten"
                active={filters.includes(FIT_FILTER)}
                onToggle={() => toggleFilter(FIT_FILTER)}
              />
            ) : null}
          </span>
        </div>
      ) : null}

      <p className="cw-prose" aria-live="polite">
        {visible.length === CLASSES.length
          ? `${CLASSES.length} Klassen stehen zur Wahl.`
          : visible.length === 1
            ? `Eine Klasse von ${CLASSES.length} passt.`
            : `${visible.length} von ${CLASSES.length} Klassen passen.`}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon="search-x"
          title="Keine Klasse passt zu dieser Suche."
          description="Die Filter greifen zusammen, nicht nebeneinander: Je mehr davon aktiv sind, desto weniger bleibt übrig. Nimm einen Filter heraus oder setze die Suche zurück."
          action={
            <Button variant="outline" onClick={resetSearch}>
              Suche und Filter zurücksetzen
            </Button>
          }
        />
      ) : (
        <div className="cw-grid" role="group" aria-labelledby="cw-class-heading">
          {visible.map((entry) => (
            <ClassTile
              key={entry.key}
              dndClass={entry}
              fit={classFit(entry, high)}
              selected={draft.classKey === entry.key}
              onSelect={chooseClass}
            />
          ))}
        </div>
      )}

      {dndClass ? (
        <section>
          <h3 id="cw-subclass-heading">
            {subclassNow
              ? `${dndClass.subclassLabel} wählen`
              : `${dndClass.subclassLabel} kommt auf Stufe ${dndClass.subclassLevel}`}
          </h3>
          <p className="cw-prose">{subclassNote(dndClass, subclassNow)}</p>
          {subclassNow ? (
            <div className="cw-grid" role="group" aria-labelledby="cw-subclass-heading">
              {dndClass.subclasses.map((subclass) => (
                <SubclassTile
                  key={subclass.key}
                  subclass={subclass}
                  selected={draft.subclassKey === subclass.key}
                  onSelect={(next) => set("subclassKey", next.key)}
                />
              ))}
            </div>
          ) : null}
          <details className="cw-disclosure">
            <summary>
              {resolved.subclass
                ? `${resolved.subclass.name} — voller Regeltext`
                : `Was zur Wahl steht: ${dndClass.subclasses.map((entry) => entry.name).join(", ")}`}
            </summary>
            <div className="cw-prose">
              {(resolved.subclass ? [resolved.subclass] : dndClass.subclasses).map((subclass) => (
                <div key={subclass.key}>
                  <p>
                    <strong>{subclass.name}</strong> — {subclass.hook}
                  </p>
                  <FeatureList features={subclass.features} />
                </div>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      {visible.length > 0 ? (
        <section>
          <h3>Regeln nachschlagen</h3>
          <p className="cw-prose">
            Die Kachel trägt die Entscheidung, hier stehen die Merkmale der Stufe 1 und
            die Übungen — je ein Aufklapper pro angezeigter Klasse.
          </p>
          {visible.map((entry) => (
            <details className="cw-disclosure" key={entry.key}>
              <summary>
                {entry.name} — Merkmale der Stufe 1
                {draft.classKey === entry.key ? " · deine Wahl" : ""}
              </summary>
              <ClassRules dndClass={entry} />
            </details>
          ))}
        </section>
      ) : null}
    </>
  );
}
