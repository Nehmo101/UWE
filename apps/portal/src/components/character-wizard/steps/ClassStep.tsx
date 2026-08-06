"use client";

/**
 * Schritt 2 — die Klasse.
 *
 * Zwölf Kacheln sind die dichteste Stelle des Erstellers. Damit sie lesbar
 * bleibt, liegt auf jeder Kachel dieselbe Kennzahlenreihe in derselben
 * Reihenfolge: Trefferwürfel, Primärattribut, Rettungswürfe, Anspruch. Erst
 * danach kommen drei Rollenschlagworte und zuletzt die Empfehlungsmarken.
 *
 * Vier Entscheidungshilfen sind hier eingebaut: „Gut für den Anfang“ auf
 * allen Klassen mit `complexity === 1`; die Passung zu bereits verteilten
 * Attributen, weil der Ersteller ausdrücklich erlaubt, zuerst zu würfeln; die
 * Ansage, wann die Unterklasse fällt — im SRD 2024 auf Stufe 3, also nicht
 * jetzt; und die Vorwarnung für die drei Klassen, denen der Hintergrund-
 * Katalog nichts Passendes anbietet (`background-gap.ts`). Letztere steht
 * schon hier und nicht erst im Hintergrund-Schritt, weil sie dort eine
 * Enttäuschung wäre und hier eine Information ist.
 *
 * Die Wappen zeichnet `TileArt` (`class/ClassArt.tsx`).
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
import { artSource } from "../art";

import { Button } from "@/src/components/ui/button";
import { NavIcon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { Alert, EmptyState } from "@/src/components/ui/states";
import { lacksMatchingBackground } from "../background-gap";
import { TileArt } from "./class/ClassArt";
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
      <TileArt entryKey={dndClass.key} src={artSource(dndClass.art)} />
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
        {/* Ruhig gehalten: eine Angabe wie Trefferwürfel, kein Warnschild. */}
        {lacksMatchingBackground(dndClass.key) ? (
          <span className="cw-chip" data-wrap="true">
            Kein fertiger Hintergrund hebt beide Primärwerte — dafür gibt es den
            eigenen Hintergrund
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
          <span className="cw-search__field">
            <Input
              id="cw-class-search"
              type="search"
              value={query}
              placeholder="Name, Rolle oder Merkmal"
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
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
