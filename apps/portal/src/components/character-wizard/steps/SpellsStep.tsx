"use client";

/**
 * Schritt 7: Zauber.
 *
 * Der Schritt hat zwei völlig verschiedene Gesichter, und beide müssen
 * gestaltet sein:
 *
 *  - **Die Klasse zaubert nicht.** Dann steht hier kein leeres Raster und
 *    kein „keine Einträge“, sondern ein Satz, der erklärt, warum das in
 *    Ordnung ist, und ein Weg weiter. Ein Kämpfer, der auf eine leere Fläche
 *    schaut, glaubt, etwas sei kaputt.
 *  - **Die Klasse zaubert.** Dann zwei Abschnitte — Zaubertricks und Zauber
 *    des 1. Grades — mit je einem lebenden Zähler, Suche, Schulfiltern und
 *    Karten, die dieselben Kennzahlen an derselben Stelle tragen.
 *
 * Die Anzahl ist hart: `cantripsKnown` und `spellsKnownAtFirst`. Wer den
 * Deckel erreicht hat, bekommt beim nächsten Klick keinen stillen Fehlschlag,
 * sondern einen Satz, der sagt, was zu tun ist.
 */

import { useMemo, useState } from "react";
import {
  needsSpellStep,
  spellsForClass,
  type MagicSchool,
  type Spell,
} from "@uwe/character-creator";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { NavIcon } from "@/src/components/ui/icon";
import type { StepProps } from "../types";

/** Ab so vielen Einträgen lohnt ein Suchfeld. */
const SEARCH_THRESHOLD = 8;

const SCHOOL_LABELS: Record<MagicSchool, string> = {
  abjuration: "Bannmagie",
  conjuration: "Beschwörung",
  divination: "Erkenntnismagie",
  enchantment: "Verzauberung",
  evocation: "Hervorrufung",
  illusion: "Illusion",
  necromancy: "Nekromantie",
  transmutation: "Verwandlung",
};

function paragraphs(text: string): string[] {
  return text
    .split("\n\n")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** „V, G, M“ — die Komponenten in einer Marke statt in drei. */
function componentLabel(spell: Spell): string {
  const parts: string[] = [];
  if (spell.components.verbal) parts.push("V");
  if (spell.components.somatic) parts.push("G");
  if (spell.components.material) parts.push("M");
  return parts.length > 0 ? parts.join(", ") : "keine";
}

interface SpellCardProps {
  spell: Spell;
  selected: boolean;
  onToggle: () => void;
}

function SpellCard({ spell, selected, onToggle }: SpellCardProps) {
  return (
    <div className="cw-choice">
      <button type="button" className="cw-tile" aria-pressed={selected} onClick={onToggle}>
        <span className="cw-tile__check" aria-hidden="true">
          <NavIcon name="check" width={16} height={16} />
        </span>
        <span className="cw-tile__name">{spell.name}</span>
        <span className="cw-tile__hook">{spell.hook}</span>

        {/* Immer dieselbe Reihenfolge: Grad, Schule, Wirkzeit, Reichweite,
            Dauer, Komponenten — danach erst die Ausnahmemarken. */}
        <span className="cw-tile__meta">
          <span className="cw-chip">
            {spell.level === 0 ? "Zaubertrick" : `${spell.level}. Grad`}
          </span>
          <span className="cw-chip">{SCHOOL_LABELS[spell.school]}</span>
          <span className="cw-chip">
            Wirkzeit <span className="cw-chip__value">{spell.castingTime}</span>
          </span>
          <span className="cw-chip">
            Reichweite <span className="cw-chip__value">{spell.range}</span>
          </span>
          <span className="cw-chip">
            Dauer <span className="cw-chip__value">{spell.duration}</span>
          </span>
          <span className="cw-chip">
            Komponenten <span className="cw-chip__value">{componentLabel(spell)}</span>
          </span>
          {spell.concentration ? (
            <span className="cw-chip" data-tone="accent">
              Konzentration
            </span>
          ) : null}
          {spell.ritual ? (
            <span className="cw-chip" data-tone="accent">
              Ritual
            </span>
          ) : null}
        </span>
      </button>

      <details className="cw-disclosure">
        <summary>Voller Regeltext</summary>
        <div className="cw-prose">
          {paragraphs(spell.description).map((part) => (
            <p key={part.slice(0, 32)}>{part}</p>
          ))}
          {spell.components.material ? (
            <p>Materialkomponente: {spell.components.material}</p>
          ) : null}
        </div>
      </details>
    </div>
  );
}

interface SpellSectionProps {
  title: string;
  /** Ein Satz darunter — was dieser Abschnitt überhaupt ist. */
  lede: string;
  /** Mehrzahl für die Zähler- und Sperrmeldung („Zaubertricks“). */
  noun: string;
  spells: Spell[];
  chosen: string[];
  limit: number;
  onChange: (next: string[]) => void;
}

function SpellSection({
  title,
  lede,
  noun,
  spells,
  chosen,
  limit,
  onChange,
}: SpellSectionProps) {
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState<MagicSchool | "all">("all");
  const [blocked, setBlocked] = useState<string | null>(null);

  const schools = useMemo(() => {
    const present = new Set<MagicSchool>(spells.map((spell) => spell.school));
    return (Object.keys(SCHOOL_LABELS) as MagicSchool[]).filter((key) => present.has(key));
  }, [spells]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return spells.filter((spell) => {
      if (school !== "all" && spell.school !== school) return false;
      if (needle.length === 0) return true;
      const haystack = [
        spell.name,
        spell.nameEn,
        spell.hook,
        spell.castingTime,
        spell.range,
        spell.duration,
        SCHOOL_LABELS[spell.school],
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [spells, query, school]);

  const remaining = limit - chosen.length;

  function toggle(key: string): void {
    if (chosen.includes(key)) {
      onChange(chosen.filter((entry) => entry !== key));
      setBlocked(null);
      return;
    }
    if (chosen.length >= limit) {
      setBlocked(
        `Du hast bereits ${limit} ${noun} gewählt — mehr gibt deine Klasse auf Stufe 1 ` +
          "nicht her. Nimm zuerst einen ab, dann kannst du tauschen.",
      );
      return;
    }
    onChange([...chosen, key]);
    setBlocked(null);
  }

  const counterLabel =
    remaining > 0
      ? `noch ${remaining} zu wählen`
      : remaining === 0
        ? "vollständig"
        : `${Math.abs(remaining)} zu viel`;

  return (
    <section className="cw-section">
      <div className="cw-section__head">
        <h3 className="cw-section__title">{title}</h3>
        <span
          className="cw-chip"
          data-tone={remaining === 0 ? undefined : "accent"}
          role="status"
          aria-live="polite"
        >
          <span className="cw-chip__value">
            {chosen.length}/{limit}
          </span>
          {counterLabel}
        </span>
        {/* Steht immer da, auch leer und abgeschaltet: Erschiene die Schaltfläche
            erst beim ersten Klick, würde sie das Raster darunter wegschieben. */}
        <Button
          variant="ghost"
          size="sm"
          disabled={chosen.length === 0}
          onClick={() => {
            onChange([]);
            setBlocked(null);
          }}
        >
          Auswahl leeren
        </Button>
      </div>
      <p className="cw-section__note">{lede}</p>

      {spells.length === 0 ? (
        <div className="cw-empty">
          <span className="cw-empty__icon" aria-hidden="true">
            <NavIcon name="book-x" width={28} height={28} />
          </span>
          <p className="cw-empty__title">Für diese Liste ist noch nichts hinterlegt</p>
          <p className="cw-empty__text">
            Der Katalog führt zu deiner Klasse keine {noun}. Das ist eine Lücke im
            Inhalt, keine Regel — sag deiner Spielleitung Bescheid und trage sie am
            Tisch nach.
          </p>
        </div>
      ) : (
        <>
          <div className="cw-search">
            {spells.length > SEARCH_THRESHOLD ? (
              <span className="cw-search__field">
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Zauber suchen"
                  aria-label={`${title} durchsuchen`}
                />
              </span>
            ) : null}

            <div className="cw-filters" role="group" aria-label={`${title} nach Schule filtern`}>
              <button
                type="button"
                className="cw-filter"
                aria-pressed={school === "all"}
                onClick={() => setSchool("all")}
              >
                Alle Schulen
              </button>
              {schools.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="cw-filter"
                  aria-pressed={school === key}
                  onClick={() => setSchool(key)}
                >
                  {SCHOOL_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="cw-empty">
              <span className="cw-empty__icon" aria-hidden="true">
                <NavIcon name="search-x" width={28} height={28} />
              </span>
              <p className="cw-empty__title">Kein Zauber passt dazu</p>
              <p className="cw-empty__text">
                Deine Suche und der Schulfilter treffen zusammen keinen Eintrag. Nimm
                den Filter heraus, um alle {spells.length} {noun} wieder zu sehen.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setSchool("all");
                }}
              >
                Filter zurücksetzen
              </Button>
            </div>
          ) : (
            <div className="cw-grid" role="group" aria-label={title}>
              {visible.map((spell) => (
                <SpellCard
                  key={spell.key}
                  spell={spell}
                  selected={chosen.includes(spell.key)}
                  onToggle={() => toggle(spell.key)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Der Platz für die Sperrmeldung liegt unter dem Raster — dort schiebt
          er nichts weg, was man gerade anklickt. */}
      <div role="status" aria-live="polite">
        {blocked ? (
          <div className="cw-note" data-tone="blocked">
            <NavIcon name="triangle-alert" width={18} height={18} />
            <span className="cw-note__text">{blocked}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function SpellsStep({ draft, set, resolved, goTo }: StepProps) {
  const dndClass = resolved.dndClass;
  const background = resolved.background;

  const spellcasting = dndClass?.spellcasting ?? null;
  const listKey = spellcasting ? spellcasting.spellList || dndClass?.key || "" : "";

  const cantripOptions = useMemo(
    () => (listKey ? spellsForClass(listKey, 0) : []),
    [listKey],
  );
  const levelOneOptions = useMemo(
    () => (listKey ? spellsForClass(listKey, 1) : []),
    [listKey],
  );

  if (!dndClass) {
    return (
      <div className="cw-empty">
        <span className="cw-empty__icon" aria-hidden="true">
          <NavIcon name="sparkles" width={28} height={28} />
        </span>
        <p className="cw-empty__title">Erst die Klasse, dann die Magie</p>
        <p className="cw-empty__text">
          Ob und was dein Charakter zaubert, entscheidet die Klasse. Wähle sie zuerst —
          danach steht hier entweder eine Zauberliste oder ein sehr kurzer Satz.
        </p>
        <Button onClick={() => goTo("class")}>
          Zur Klassenwahl
          <NavIcon name="arrow-right" width={16} height={16} />
        </Button>
      </div>
    );
  }

  /**
   * Kein Zauberwirken auf Stufe 1 — entweder gar keine Zauberei (Kämpfer,
   * Barbar, Schurke, Mönch) oder eine Klasse, die erst später anfängt. Beides
   * bekommt hier einen eigenen, gestalteten Zustand statt eines leeren Rasters.
   */
  if (!needsSpellStep(dndClass)) {
    const featName = background ? background.originFeat : "";
    const magicFromBackground = featName.startsWith("eingeweihter-der-magie");

    return (
      <div>
        <div className="cw-empty">
          <span className="cw-empty__icon" aria-hidden="true">
            <NavIcon name="swords" width={28} height={28} />
          </span>
          <p className="cw-empty__title">
            {dndClass.name} wirkt auf Stufe 1 keine Zauber
          </p>
          <p className="cw-empty__text">
            {spellcasting
              ? `Die Zauberei von ${dndClass.name} setzt später ein — auf Stufe 1 ist hier nichts zu wählen.`
              : `${dndClass.name} löst Probleme ohne Magie. Das ist kein Nachteil: Die Klasse bekommt ihre Stärke aus Merkmalen, die jede Runde greifen, statt aus Zaubern, die man verbraucht.`}{" "}
            Dieser Schritt ist für dich übersprungen — in der Schrittleiste steht er
            deshalb blass.
          </p>
          <span className="cw-tile__meta">
            {dndClass.roleTags.map((tag) => (
              <span key={tag} className="cw-chip">
                {tag}
              </span>
            ))}
          </span>
          <Button onClick={() => goTo("details")}>
            Weiter zur Beschreibung
            <NavIcon name="arrow-right" width={16} height={16} />
          </Button>
        </div>

        {magicFromBackground ? (
          <div className="cw-note" data-tone="accent">
            <NavIcon name="wand-sparkles" width={18} height={18} />
            <span className="cw-note__text">
              Dein Hintergrund {background?.name} bringt trotzdem Magie mit: Sein
              Ursprungstalent gibt Zaubertricks und einen Zauber des 1. Grades. Was
              genau, steht im Schritt Hintergrund im Wortlaut des Talents.
            </span>
          </div>
        ) : null}

        <div className="cw-actions">
          <Button variant="outline" onClick={() => goTo("background")}>
            Hintergrund ansehen
          </Button>
        </div>
      </div>
    );
  }

  const cantripLimit = spellcasting?.cantripsKnown ?? 0;
  const spellLimit = spellcasting?.spellsKnownAtFirst ?? 0;

  return (
    <div>
      <p className="cw-section__note">
        {dndClass.name} zaubert mit{" "}
        {spellcasting?.preparation === "prepared"
          ? "einer vorbereiteten Liste"
          : "fest gewählten Zaubern"}
        . Beide Blöcke unten sind Pflicht: erst die Zaubertricks, die du unbegrenzt
        oft wirken darfst, dann die Zauber des 1. Grades, für die du Zauberplätze
        ausgibst.
      </p>

      {cantripLimit > 0 ? (
        <SpellSection
          title="Zaubertricks"
          lede="Kleine Magie ohne Zauberplatz — du kannst sie beliebig oft wirken. Nimm mindestens einen, der Schaden macht, und einen, der etwas anderes kann."
          noun="Zaubertricks"
          spells={cantripOptions}
          chosen={draft.cantrips}
          limit={cantripLimit}
          onChange={(next) => set("cantrips", next)}
        />
      ) : null}

      {spellLimit > 0 ? (
        <SpellSection
          title="Zauber 1. Grades"
          lede="Die großen Karten auf deiner Hand. Auf Stufe 1 hast du wenige Zauberplätze — eine Mischung aus Schaden, Schutz und einem Zauber für Gespräche trägt am weitesten."
          noun="Zauber des 1. Grades"
          spells={levelOneOptions}
          chosen={draft.spells}
          limit={spellLimit}
          onChange={(next) => set("spells", next)}
        />
      ) : null}
    </div>
  );
}
