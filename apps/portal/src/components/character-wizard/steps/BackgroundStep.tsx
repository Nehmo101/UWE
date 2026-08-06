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
 *
 * **Die fünfte Kachel ist keine fünfte Kachel.** Das SRD liefert vier
 * Hintergründe, und ihre Attributstripel lassen Paladin, Mönch und Waldläufer
 * ohne passende Wahl zurück (siehe `background-gap.ts`). Der Bauplan für
 * eigene Hintergründe steht im SRD selbst — er hängt hier als gestrichelte
 * Kachel neben dem Katalog und klappt an Ort und Stelle auf, wie die
 * Abstammung beim Volk.
 */

import { useMemo, useState } from "react";
import {
  ABILITIES,
  ABILITY_LABELS,
  ABILITY_SHORT,
  BACKGROUNDS,
  CUSTOM_ABILITY_COUNT,
  CUSTOM_BACKGROUND_GOLD,
  CUSTOM_BACKGROUND_KEY,
  CUSTOM_SKILL_COUNT,
  emptyCustomBackground,
  findFeat,
  originFeats,
  type AbilityKey,
  type Background,
  type CustomBackgroundDraft,
} from "@uwe/character-creator";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { NavIcon } from "@/src/components/ui/icon";
import { SKILL_LABELS } from "../CharacterRail";
import { lacksMatchingBackground } from "../background-gap";
import { CustomBackgroundBuilder } from "./background/CustomBackgroundBuilder";
import { FeatText } from "./background/FeatText";
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

/** Wie viele Ursprungstalente der Eigenbau zur Wahl stellt. */
const ORIGIN_FEAT_COUNT = originFeats().length;

/** Wonach die Eigenbau-Kachel gefunden wird — sie hat keinen Katalogtext. */
const CUSTOM_HAYSTACK = [
  "eigener hintergrund",
  "eigenbau",
  "selbst bauen",
  "bauplan",
  "custom background",
].join(" ");

/** Absätze aus dem Katalogtext — dort trennt eine Leerzeile. */
function paragraphs(text: string): string[] {
  return text
    .split("\n\n")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
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

/**
 * Die Kachel für den Eigenbau.
 *
 * Sie sieht bewusst anders aus als die vier Katalogkarten: gestrichelter
 * Rahmen, Zeichenwerkzeug statt Wappen, und statt fertiger Kennzahlen die
 * Zahl der Wahlen, die noch zu treffen sind. Eine fünfte identische Karte
 * würde behaupten, hier stünde ein fertiger Hintergrund — hier steht ein
 * Bauplan.
 */
function CustomBackgroundTile({
  selected,
  strandedClassName,
  onSelect,
}: {
  selected: boolean;
  /** Name der Klasse, die im Katalog leer ausgeht — sonst `null`. */
  strandedClassName: string | null;
  onSelect: () => void;
}) {
  return (
    <div className="cw-choice">
      <button
        type="button"
        className="cw-tile"
        data-variant="build"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className="cw-tile__check" aria-hidden="true">
          <NavIcon name="check" width={16} height={16} />
        </span>
        <span className="cw-tile__art" aria-hidden="true">
          <NavIcon name="pencil-ruler" strokeWidth={0.75} />
        </span>
        <span className="cw-tile__name">Eigener Hintergrund</span>
        <span className="cw-tile__hook">
          Selbst zusammenstellen — nach dem Bauplan, der im Regelwerk neben den
          vier fertigen Hintergründen steht. Du bestimmst, welche Attribute er
          anhebt.
        </span>

        {/* Dieselbe Stelle wie auf den Katalogkacheln — dort steht das
            Ursprungstalent, hier steht, dass du es aussuchst. */}
        <span className="cw-feat">
          <span className="cw-feat__label">Ursprungstalent</span>
          <span className="cw-feat__name">Eines von {ORIGIN_FEAT_COUNT} zur Wahl</span>
          <span className="cw-feat__text">
            Vom Wachsam-Bonus auf die Initiative bis zu Zaubern für eine Klasse,
            die gar nicht zaubert — was jedes Talent tut, steht im Bauplan darunter.
          </span>
        </span>

        {/* Gleiche Kennzahlen in gleicher Reihenfolge wie im Katalog:
            Attribute, Fertigkeiten, Werkzeug — nur eben als Wahl. */}
        <span className="cw-tile__meta">
          <span className="cw-chip" data-tone="accent">
            <span className="cw-chip__value">{CUSTOM_ABILITY_COUNT}</span> Attribute
            nach Wahl
          </span>
          <span className="cw-chip">
            <span className="cw-chip__value">{CUSTOM_SKILL_COUNT}</span> Fertigkeiten
            nach Wahl
          </span>
          <span className="cw-chip">Werkzeug nach Wahl</span>
          <span className="cw-chip">
            <span className="cw-chip__value">{CUSTOM_BACKGROUND_GOLD}</span> GM statt
            Ausrüstung
          </span>
          {strandedClassName ? (
            <span className="cw-chip" data-tone="accent" data-wrap="true">
              Der Weg für {strandedClassName}
            </span>
          ) : null}
        </span>
      </button>

      <details className="cw-disclosure">
        <summary>Warum es den Eigenbau gibt</summary>
        <div className="cw-prose">
          <p>
            Das SRD 5.2.1 enthält vier Hintergründe. Seit der Fassung von 2024
            hängt am Hintergrund aber die Attributsverteilung, und diese vier
            decken zusammen nur vier Attributstripel ab. Für Paladin (STÄ+CHA),
            Mönch und Waldläufer (beide GES+WEI) gibt es darunter keinen, der
            beide Primärattribute anhebt.
          </p>
          <p>
            Die zwölf fehlenden Hintergründe des Spielerhandbuchs
            nachzuschreiben, wäre keine Lösung: Sie stehen nicht unter CC-BY. Der
            Ausweg steht im SRD selbst — es beschreibt, wie man einen Hintergrund
            baut. Genau diesen Bauplan bedient diese Kachel.
          </p>
          <p>
            Ergebnis ist ein ganz normaler Hintergrund. Alles dahinter —
            Vorschau, Prüfung, Charakterbogen — sieht keinen Unterschied zu einem
            Katalogeintrag.
          </p>
        </div>
      </details>
    </div>
  );
}

export function BackgroundStep({ draft, patch, resolved, goTo }: StepProps) {
  const [query, setQuery] = useState("");
  const [ability, setAbility] = useState<AbilityKey | "all">("all");

  const dndClass = resolved.dndClass;
  const stranded = lacksMatchingBackground(draft.classKey);
  const custom = draft.backgroundKey === CUSTOM_BACKGROUND_KEY;

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

  /*
   * Der Attributsfilter greift beim Eigenbau nicht: Er hebt jedes Attribut an,
   * das man ihm gibt — er fällt also nie durch diesen Filter. Nur die Suche
   * kann ihn ausblenden.
   */
  const showCustom = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle.length === 0 || CUSTOM_HAYSTACK.includes(needle);
  }, [query]);

  const shown = visible.length + (showCustom ? 1 : 0);
  const total = BACKGROUNDS.length + 1;

  /**
   * Ein Hintergrundwechsel macht die bereits verteilten Boni ungültig — sie
   * zeigen auf drei Attribute, die der neue Hintergrund gar nicht anbietet.
   * Also zurücksetzen, statt eine kaputte Verteilung stehen zu lassen. Und
   * ein Eigenbau, der nicht mehr gewählt ist, hat keinen Grund im Entwurf zu
   * bleiben.
   */
  function choose(key: string): void {
    if (draft.backgroundKey === key) return;
    patch({
      backgroundKey: key,
      customBackground: null,
      abilities: draft.abilities
        ? { ...draft.abilities, backgroundBonus: {} }
        : draft.abilities,
    });
  }

  /**
   * Der Eigenbau startet nicht leer, wenn eine Klasse feststeht: Ihre
   * Primärattribute sind vorbelegt. Das ist die eigentliche Hilfe — der
   * Spieler, dem der Katalog nichts anbietet, findet seine beiden Werte schon
   * angehakt vor und muss nur noch das dritte dazulegen.
   */
  function chooseCustom(): void {
    if (custom) return;
    patch({
      backgroundKey: CUSTOM_BACKGROUND_KEY,
      customBackground: {
        ...emptyCustomBackground(),
        abilityOptions: [...(dndClass?.primaryAbilities ?? [])].slice(0, CUSTOM_ABILITY_COUNT),
      },
      abilities: draft.abilities
        ? { ...draft.abilities, backgroundBonus: {} }
        : draft.abilities,
    });
  }

  /**
   * Wer im Bauplan die drei Attribute tauscht, entwertet damit eine bereits
   * verteilte Bonusvergabe — dieselbe Lage wie bei einem Hintergrundwechsel,
   * also dieselbe Antwort. Name, Fertigkeiten, Werkzeug und Talent lassen die
   * Verteilung dagegen unberührt.
   */
  function updateCustom(next: CustomBackgroundDraft): void {
    const before = draft.customBackground?.abilityOptions ?? [];
    const abilitiesChanged = next.abilityOptions.join("|") !== before.join("|");
    patch({
      customBackground: next,
      abilities:
        abilitiesChanged && draft.abilities
          ? { ...draft.abilities, backgroundBonus: {} }
          : draft.abilities,
    });
  }

  function resetFilters(): void {
    setQuery("");
    setAbility("all");
  }

  const showSearch = total > SEARCH_THRESHOLD;

  return (
    <section className="cw-section">
      <div className="cw-section__head">
        <h3 className="cw-section__title">Woher dein Charakter kommt</h3>
        <span className="cw-chip">
          <span className="cw-chip__value">{shown}</span>
          von {total}
        </span>
      </div>
      <p className="cw-section__note">
        Der Hintergrund ist in den Regeln von 2024 die folgenreichste Wahl der
        Erstellung: Er entscheidet, wohin deine Attributspunkte gehen, und er gibt
        dir ein Ursprungstalent — eine echte Fähigkeit, keine Randnotiz. Lies das
        Talent, bevor du dich für einen Beruf entscheidest.
      </p>

      {/*
        Der Hinweis, der diesen Schritt für drei Klassen überhaupt erst
        brauchbar macht. Er steht über den Kacheln und nicht darunter: Wer
        Paladin spielt, soll nicht erst vier Karten durchlesen, um dann zu
        merken, dass keine davon sein Charisma anhebt.
      */}
      {stranded && dndClass ? (
        <div className="cw-note" data-tone="accent">
          <NavIcon name="lightbulb" width={18} height={18} />
          <span className="cw-note__text">
            <strong>
              Für {dndClass.name} hebt kein fertiger Hintergrund beide
              Primärattribute an.
            </strong>{" "}
            {dndClass.name} steht auf{" "}
            {dndClass.primaryAbilities.map((key) => ABILITY_LABELS[key]).join(" und ")}
            , und die vier Hintergründe des SRD bieten dieses Paar nicht zusammen
            an. Das ist kein Fehler des Erstellers, sondern eine Lücke des
            Regelwerks — und das Regelwerk schließt sie selbst: Bau dir deinen
            Hintergrund nach dem Bauplan unten. Deine beiden Werte sind dort
            schon vorbelegt.{" "}
            <Button variant="link" onClick={chooseCustom}>
              Eigenen Hintergrund bauen
            </Button>
          </span>
        </div>
      ) : null}

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
          <p className="cw-empty__title">Kein fertiger Hintergrund passt dazu</p>
          <p className="cw-empty__text">
            Kein Katalog-Eintrag hebt{" "}
            {ability === "all" ? "das gesuchte Attribut" : ABILITY_LABELS[ability]} an und
            trifft zugleich deine Suche. Nimm den Filter heraus, um wieder alle vier
            SRD-Hintergründe zu sehen — oder bau dir einen, der genau dieses Attribut
            anhebt.
          </p>
          <Button variant="outline" onClick={resetFilters}>
            Filter zurücksetzen
          </Button>
        </div>
      ) : null}

      {shown > 0 ? (
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
          {showCustom ? (
            <CustomBackgroundTile
              selected={custom}
              strandedClassName={stranded && dndClass ? dndClass.name : null}
              onSelect={chooseCustom}
            />
          ) : null}
        </div>
      ) : null}

      {/*
        Der Bauplan klappt an Ort und Stelle auf — wie die Abstammung im
        Volksschritt. Ein eigener Schritt dafür würde die Schrittleiste je nach
        Wahl umbauen, und ein Dialog würde die Vorschau-Leiste verdecken, die
        genau hier mitrechnet.
      */}
      {custom ? (
        <CustomBackgroundBuilder
          value={draft.customBackground ?? emptyCustomBackground()}
          onChange={updateCustom}
          dndClass={dndClass}
          stranded={stranded}
        />
      ) : null}

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
