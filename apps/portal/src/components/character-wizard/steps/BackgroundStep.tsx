"use client";

/**
 * Schritt 3: Hintergrund.
 *
 * In den Regeln von 2024 ist das der folgenreichste Klick der ganzen
 * Erstellung. Der Hintergrund bestimmt drei Dinge auf einmal:
 *
 *   1. **Wo die Attributspunkte hingehen** — drei Attribute, darin +2/+1
 *      oder +1/+1/+1. Es gibt keinen Spezies-Bonus mehr.
 *   2. **Ein Ursprungstalent**, das echte Fähigkeiten mitbringt — bis hin zu
 *      Zaubern für Klassen, die gar nicht zaubern können.
 *   3. Zwei Fertigkeiten, ein Werkzeug, Ausrüstung.
 *
 * Deshalb steht das Talent hier nicht als Wort in einer Chipreihe, sondern
 * aufgelöst über `findFeat` mit seinem Haken auf der Kachel: Wer „Wachsam“
 * liest, weiß nichts; wer liest, was Wachsam tut, entscheidet.
 *
 * Die Kachel trägt die Entscheidung, drei `<details>` darunter den Wortlaut —
 * Talent, Ausrüstung, Hintergrundtext. Ein `<details>` darf nicht in einen
 * `<button>`, deshalb liegen beide zusammen in `.cw-choice`.
 */

import { useMemo, useState } from "react";
import {
  ABILITIES,
  ABILITY_LABELS,
  ABILITY_SHORT,
  BACKGROUNDS,
  findFeat,
  type AbilityKey,
  type Background,
  type Feat,
} from "@uwe/character-creator";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { NavIcon } from "@/src/components/ui/icon";
import { SKILL_LABELS } from "../CharacterRail";
import type { StepProps } from "../types";

/**
 * Bildmarke je Hintergrund. Es gibt (noch) keine gezeichneten Wappen unter
 * `/character-creator/backgrounds/`, und die CSP verbietet fremde Quellen —
 * also ein Lucide-Glyph, der die Kachel trägt, ohne etwas zu behaupten.
 */
const BACKGROUND_ICONS: Record<string, string> = {
  akolyth: "church",
  krimineller: "key-round",
  weiser: "book-open",
  soldat: "shield",
};

/** Ab so vielen Einträgen lohnt ein Suchfeld. Darunter ist es nur Lärm. */
const SEARCH_THRESHOLD = 8;

/** Absätze aus dem Katalogtext — dort trennt eine Leerzeile. */
function paragraphs(text: string): string[] {
  return text
    .split("\n\n")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Der Wortlaut eines Talents: Voraussetzung, Vorteile, Attributspunkt. */
function FeatText({ feat }: { feat: Feat }) {
  return (
    <div className="cw-prose">
      {feat.prerequisite ? <p>Voraussetzung: {feat.prerequisite}</p> : null}
      <p>{feat.hook}</p>
      {feat.benefits.map((benefit) => (
        <p key={benefit.name}>
          <strong>{benefit.name}.</strong> {benefit.description}
        </p>
      ))}
      {feat.abilityIncrease ? (
        <p>
          Dazu ein Punkt auf eines dieser Attribute (höchstens 20):{" "}
          {feat.abilityIncrease.from.map((ability) => ABILITY_LABELS[ability]).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

interface BackgroundCardProps {
  background: Background;
  selected: boolean;
  /** Name der gewählten Klasse, wenn deren Hauptattribut hier vorkommt. */
  recommendedFor: string | null;
  onSelect: () => void;
}

function BackgroundCard({
  background,
  selected,
  recommendedFor,
  onSelect,
}: BackgroundCardProps) {
  const feat = findFeat(background.originFeat);

  return (
    <div className="cw-choice">
      <button
        type="button"
        className="cw-tile"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className="cw-tile__check" aria-hidden="true">
          <NavIcon name="check" width={16} height={16} />
        </span>
        <span className="cw-tile__art" aria-hidden="true">
          <NavIcon
            name={BACKGROUND_ICONS[background.key] ?? "scroll-text"}
            strokeWidth={0.75}
          />
        </span>
        <span className="cw-tile__name">{background.name}</span>
        <span className="cw-tile__hook">{background.hook}</span>

        {/* Das Ursprungstalent — aufgelöst, nicht nur benannt. */}
        <span className="cw-feat">
          <span className="cw-feat__label">Ursprungstalent</span>
          <span className="cw-feat__name">{feat ? feat.name : background.originFeat}</span>
          <span className="cw-feat__text">
            {feat
              ? feat.hook
              : "Dieses Talent fehlt noch im Katalog — der Wortlaut steht im Regelwerk."}
          </span>
        </span>

        {/* Immer dieselben Kennzahlen an derselben Stelle: erst die drei
            Attribute, dann die zwei Fertigkeiten, dann das Werkzeug. */}
        <span className="cw-tile__meta">
          {background.abilityOptions.map((ability) => (
            <span key={ability} className="cw-chip" data-tone="accent">
              {ABILITY_SHORT[ability]}
            </span>
          ))}
          {background.skills.map((skill) => (
            <span key={skill} className="cw-chip">
              {SKILL_LABELS[skill] ?? skill}
            </span>
          ))}
          {background.toolProficiency ? (
            <span className="cw-chip">{background.toolProficiency}</span>
          ) : null}
          {recommendedFor ? (
            <span className="cw-chip" data-tone="accent">
              Passt zu {recommendedFor}
            </span>
          ) : null}
        </span>
      </button>

      {feat ? (
        <details className="cw-disclosure">
          <summary>Was {feat.name} genau kann</summary>
          <FeatText feat={feat} />
        </details>
      ) : null}

      <details className="cw-disclosure">
        <summary>Ausrüstung und Startgold</summary>
        <ul className="cw-items">
          {background.equipment.map((line) => (
            <li key={line} className="cw-item">
              <span className="cw-item__qty" aria-hidden="true">
                ●
              </span>
              <span className="cw-item__name">{line}</span>
            </li>
          ))}
        </ul>
        <p className="cw-prose">
          Dazu {background.startingGold} GM Startgold. Der SRD erlaubt statt Paket und
          Gold eine feste Goldsumme — welche, steht im Hintergrundtext.
        </p>
      </details>

      <details className="cw-disclosure">
        <summary>Ganzer Hintergrundtext</summary>
        <div className="cw-prose">
          {paragraphs(background.description).map((part) => (
            <p key={part.slice(0, 32)}>{part}</p>
          ))}
        </div>
      </details>
    </div>
  );
}

export function BackgroundStep({ draft, patch, resolved, goTo }: StepProps) {
  const [query, setQuery] = useState("");
  const [ability, setAbility] = useState<AbilityKey | "all">("all");

  const dndClass = resolved.dndClass;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return BACKGROUNDS.filter((entry) => {
      if (ability !== "all" && !entry.abilityOptions.includes(ability)) return false;
      if (needle.length === 0) return true;
      const feat = findFeat(entry.originFeat);
      const haystack = [
        entry.name,
        entry.nameEn,
        entry.hook,
        entry.toolProficiency ?? "",
        feat?.name ?? "",
        feat?.hook ?? "",
        ...entry.skills.map((skill) => SKILL_LABELS[skill] ?? skill),
        ...entry.abilityOptions.map((key) => ABILITY_LABELS[key]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, ability]);

  /**
   * Ein Hintergrundwechsel macht die bereits verteilten Boni ungültig — sie
   * zeigen auf drei Attribute, die der neue Hintergrund gar nicht anbietet.
   * Also zurücksetzen, statt eine kaputte Verteilung stehen zu lassen.
   */
  function choose(key: string): void {
    if (draft.backgroundKey === key) return;
    patch({
      backgroundKey: key,
      abilities: draft.abilities
        ? { ...draft.abilities, backgroundBonus: {} }
        : draft.abilities,
    });
  }

  function resetFilters(): void {
    setQuery("");
    setAbility("all");
  }

  const showSearch = BACKGROUNDS.length > SEARCH_THRESHOLD;

  return (
    <section className="cw-section">
      <div className="cw-section__head">
        <h3 className="cw-section__title">Woher dein Charakter kommt</h3>
        <span className="cw-chip">
          <span className="cw-chip__value">{visible.length}</span>
          von {BACKGROUNDS.length}
        </span>
      </div>
      <p className="cw-section__note">
        Der Hintergrund ist in den Regeln von 2024 die folgenreichste Wahl der
        Erstellung: Er entscheidet, wohin deine Attributspunkte gehen, und er gibt
        dir ein Ursprungstalent — eine echte Fähigkeit, keine Randnotiz. Lies das
        Talent, bevor du dich für einen Beruf entscheidest.
      </p>

      <div className="cw-search">
        {showSearch ? (
          <span className="cw-search__field">
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Hintergrund, Talent oder Fertigkeit suchen"
              aria-label="Hintergründe durchsuchen"
            />
          </span>
        ) : null}

        <div className="cw-filters" role="group" aria-label="Nach angehobenem Attribut filtern">
          <button
            type="button"
            className="cw-filter"
            aria-pressed={ability === "all"}
            onClick={() => setAbility("all")}
          >
            Alle
          </button>
          {ABILITIES.map((key) => (
            <button
              key={key}
              type="button"
              className="cw-filter"
              aria-pressed={ability === key}
              aria-label={`Nur Hintergründe, die ${ABILITY_LABELS[key]} anheben`}
              onClick={() => setAbility(key)}
            >
              {ABILITY_SHORT[key]}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="cw-empty">
          <span className="cw-empty__icon" aria-hidden="true">
            <NavIcon name="search-x" width={28} height={28} />
          </span>
          <p className="cw-empty__title">Kein Hintergrund passt dazu</p>
          <p className="cw-empty__text">
            Kein Eintrag hebt {ability === "all" ? "das gesuchte Attribut" : ABILITY_LABELS[ability]}{" "}
            an und trifft zugleich deine Suche. Nimm den Filter heraus, um wieder alle
            vier SRD-Hintergründe zu sehen.
          </p>
          <Button variant="outline" onClick={resetFilters}>
            Filter zurücksetzen
          </Button>
        </div>
      ) : (
        <div className="cw-grid" role="group" aria-label="Hintergründe">
          {visible.map((background) => (
            <BackgroundCard
              key={background.key}
              background={background}
              selected={draft.backgroundKey === background.key}
              recommendedFor={
                dndClass &&
                dndClass.primaryAbilities.some((primary) =>
                  background.abilityOptions.includes(primary),
                )
                  ? dndClass.name
                  : null
              }
              onSelect={() => choose(background.key)}
            />
          ))}
        </div>
      )}

      {resolved.background ? (
        <div className="cw-note" data-tone="accent">
          <NavIcon name="info" width={18} height={18} />
          <span className="cw-note__text">
            {resolved.background.name} gibt dir Punkte auf{" "}
            {resolved.background.abilityOptions
              .map((key) => ABILITY_LABELS[key])
              .join(", ")}
            . Verteilt werden sie im Schritt Attribute — als +2/+1 oder +1/+1/+1.
          </span>
        </div>
      ) : null}

      {resolved.background ? (
        <div className="cw-actions">
          <Button variant="outline" onClick={() => goTo("abilities")}>
            Boni jetzt verteilen
            <NavIcon name="arrow-right" width={16} height={16} />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
