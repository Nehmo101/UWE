"use client";

/**
 * Der Eigenbau-Hintergrund — der Bauplan aus dem Regelwerk zum Anklicken.
 *
 * Er folgt `rules/custom-background.ts`: drei Attribute, zwei Fertigkeiten,
 * Werkzeug, Ursprungstalent, 50 GM statt Ausrüstung. Mit dem vollen Katalog
 * braucht keine Klasse den Eigenbau mehr — er bleibt für eigene Geschichten.
 *
 * Er läuft **an Ort und Stelle**, nicht als zehnter Schritt: wie die
 * Abstammung beim Volk klappt er unter den Kacheln auf, sobald die Kachel
 * „Eigener Hintergrund“ gewählt ist. Wer ihn wieder verlässt, verliert ihn —
 * das entscheidet der Schritt, nicht dieses Formular.
 *
 * Die Prüfung macht `checkCustomBackground`. Hier wird nur gefragt, angezeigt
 * und weitergereicht; gerechnet wird nichts.
 */

import { useId, useMemo, useState } from "react";
import {
  ABILITIES,
  ABILITY_HINTS,
  ABILITY_LABELS,
  ABILITY_SHORT,
  CUSTOM_ABILITY_COUNT,
  CUSTOM_BACKGROUND_GOLD,
  CUSTOM_SKILL_COUNT,
  CUSTOM_TOOL_OPTIONS,
  SKILLS,
  checkCustomBackground,
  originFeats,
  type AbilityKey,
  type CustomBackgroundDraft,
  type DndClass,
  type SkillKey,
} from "@uwe/character-creator";

import { NavIcon } from "@/src/components/ui/icon";
import { Input } from "@/src/components/ui/input";
import { SKILL_LABELS } from "../../CharacterRail";
import { FeatText } from "./FeatText";

/** Der Katalog ändert sich zur Laufzeit nicht — einmal beim Laden reicht. */
const ORIGIN_FEATS = originFeats();

/** Alphabetisch, damit man eine bestimmte Fertigkeit findet, statt zu suchen. */
const SORTED_SKILLS: SkillKey[] = [...SKILLS].sort((left, right) =>
  (SKILL_LABELS[left] ?? left).localeCompare(SKILL_LABELS[right] ?? right, "de"),
);

/** „noch 2 wählen“ — der Satz, der die Zahl im Kopf des Spielers ersetzt. */
function counterText(chosen: number, want: number, singular: string, plural: string): string {
  const missing = want - chosen;
  if (missing === 0) return `Vollständig: ${want} ${plural} gewählt.`;
  if (missing < 0) return `${-missing} zu viel — nimm ${-missing === 1 ? "eine" : "einige"} wieder ab.`;
  return `Noch ${missing} ${missing === 1 ? singular : plural} wählen.`;
}

function joinNames(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
}

/**
 * Der Halbsatz, der die Klasse mit den drei Attributen verbindet.
 *
 * Er ändert sich mit dem Stand der Wahl: Solange die Primärattribute noch
 * angehakt sind (weil der Schritt sie vorbelegt hat), sagt er das; wer sie
 * abgewählt hat, bekommt keine Behauptung über eine Vorbelegung, die nicht
 * mehr steht, sondern den Hinweis, was die Klasse tragen würde.
 */
function classHint(
  dndClass: DndClass | null,
  chosen: readonly AbilityKey[],
  stranded: boolean,
): string | null {
  const primaries = dndClass?.primaryAbilities ?? [];
  if (!dndClass || primaries.length === 0) return null;

  const named = joinNames(primaries.map((ability) => ABILITY_LABELS[ability]));
  const gap = stranded
    ? ` Kein fertiger Hintergrund hebt ${named} zusammen an — genau dafür gibt es diesen Bauplan.`
    : "";

  if (primaries.every((ability) => chosen.includes(ability))) {
    return `${dndClass.name} steht auf ${named}; beides ist hier vorbelegt.${gap} Du darfst es jederzeit abwählen.`;
  }
  return `${dndClass.name} steht auf ${named}.${gap} Wer beide anhebt, spielt die Klasse so, wie sie gerechnet ist.`;
}

export interface CustomBackgroundBuilderProps {
  value: CustomBackgroundDraft;
  onChange: (next: CustomBackgroundDraft) => void;
  /** Die gewählte Klasse — sie erklärt die vorbelegten Attribute. */
  dndClass: DndClass | null;
  /** Findet diese Klasse im Katalog keinen passenden Hintergrund? */
  stranded: boolean;
}

export function CustomBackgroundBuilder({
  value,
  onChange,
  dndClass,
  stranded,
}: CustomBackgroundBuilderProps) {
  const fieldId = useId();
  const id = (suffix: string) => `${fieldId}-${suffix}`;

  /**
   * Ein abgelehnter Klick darf nicht stumm bleiben — sonst liest er sich als
   * kaputte Oberfläche. Je Gruppe eine Meldung, die sagt, was stattdessen zu
   * tun ist.
   */
  const [abilityNotice, setAbilityNotice] = useState<string | null>(null);
  const [skillNotice, setSkillNotice] = useState<string | null>(null);

  const problems = useMemo(() => checkCustomBackground(value, ORIGIN_FEATS), [value]);

  const primaries = dndClass?.primaryAbilities ?? [];
  const feat = ORIGIN_FEATS.find((entry) => entry.key === value.originFeat) ?? null;

  function toggleAbility(ability: AbilityKey): void {
    if (value.abilityOptions.includes(ability)) {
      setAbilityNotice(null);
      onChange({
        ...value,
        abilityOptions: value.abilityOptions.filter((entry) => entry !== ability),
      });
      return;
    }
    if (value.abilityOptions.length >= CUSTOM_ABILITY_COUNT) {
      setAbilityNotice(
        `Drei Attribute sind bereits gewählt: ` +
          `${joinNames(value.abilityOptions.map((entry) => ABILITY_LABELS[entry]))}. ` +
          `Nimm eines davon ab, dann ist ${ABILITY_LABELS[ability]} frei.`,
      );
      return;
    }
    setAbilityNotice(null);
    onChange({ ...value, abilityOptions: [...value.abilityOptions, ability] });
  }

  function toggleSkill(skill: SkillKey): void {
    const label = SKILL_LABELS[skill] ?? skill;
    if (value.skills.includes(skill)) {
      setSkillNotice(null);
      onChange({ ...value, skills: value.skills.filter((entry) => entry !== skill) });
      return;
    }
    if (value.skills.length >= CUSTOM_SKILL_COUNT) {
      setSkillNotice(
        `Zwei Fertigkeiten sind bereits gewählt: ` +
          `${joinNames(value.skills.map((entry) => SKILL_LABELS[entry] ?? entry))}. ` +
          `Nimm eine davon ab, dann ist ${label} frei.`,
      );
      return;
    }
    setSkillNotice(null);
    onChange({ ...value, skills: [...value.skills, skill] });
  }

  return (
    <section className="cw-section" aria-labelledby={id("heading")}>
      <div className="cw-section__head">
        <h3 className="cw-section__title" id={id("heading")}>
          Deinen Hintergrund bauen
        </h3>
        <span className="cw-chip" data-tone="accent" aria-live="polite">
          {problems.complete ? (
            "vollständig"
          ) : (
            <>
              <span className="cw-chip__value">{problems.issues.length}</span> offen
            </>
          )}
        </span>
      </div>

      <p className="cw-section__note">
        Der Bauplan steht im SRD selbst: drei Attribute, zwei Fertigkeiten, eine
        Werkzeugkunde, ein Ursprungstalent — und statt einer Ausrüstungsliste{" "}
        {CUSTOM_BACKGROUND_GOLD} Goldmünzen. Was dabei herauskommt, ist ein ganz
        normaler Hintergrund; Vorschau, Prüfung und Charakterbogen sehen keinen
        Unterschied zu einem Eintrag aus dem Katalog.
      </p>

      <div className="cw-form">
        {/* ───────────────────────── Name ───────────────────────── */}
        <fieldset className="cw-fieldset">
          <legend className="cw-fieldset__legend">Wie heißt er?</legend>
          <p className="cw-fieldset__hint">
            Der Name steht später auf dem Bogen, wo sonst „Soldat“ oder „Weiser“
            stünde. Ein Beruf, ein Stand, eine Herkunft — was dein Charakter war,
            bevor das Abenteuer anfing.
          </p>
          <div className="cw-fields">
            <div className="cw-field" data-span="full">
              <label className="cw-field__label" htmlFor={id("name")}>
                Name des Hintergrunds
                <span className="cw-field__required">Pflicht</span>
              </label>
              <Input
                id={id("name")}
                value={value.name}
                placeholder="z. B. Grenzwächterin, Hafenschreiber, Karawanenkind"
                onChange={(event) => onChange({ ...value, name: event.target.value })}
              />
            </div>
          </div>
        </fieldset>

        {/* ─────────────────────── Drei Attribute ─────────────────────── */}
        <fieldset className="cw-fieldset">
          <legend className="cw-fieldset__legend">Drei Attribute</legend>
          <p className="cw-fieldset__hint">
            Auf diese drei verteilst du im Schritt „Attribute“ entweder +2 und +1
            oder dreimal +1. Das ist der ganze Grund, warum es diesen Bauplan
            gibt — hier entscheidest du, wo deine Punkte landen.{" "}
            {classHint(dndClass, value.abilityOptions, stranded)}
          </p>

          <p className="cw-field__hint" aria-live="polite">
            {counterText(value.abilityOptions.length, CUSTOM_ABILITY_COUNT, "Attribut", "Attribute")}
          </p>

          <div className="cw-grid" data-density="compact" role="group" aria-label="Attribute wählen">
            {ABILITIES.map((ability) => {
              const selected = value.abilityOptions.includes(ability);
              const primary = primaries.includes(ability);
              return (
                <button
                  key={ability}
                  type="button"
                  className="cw-tile"
                  aria-pressed={selected}
                  onClick={() => toggleAbility(ability)}
                >
                  <span className="cw-tile__check" aria-hidden="true">
                    <NavIcon name="check" width={16} height={16} />
                  </span>
                  <span className="cw-tile__name">{ABILITY_LABELS[ability]}</span>
                  <span className="cw-tile__hook">{ABILITY_HINTS[ability]}</span>
                  <span className="cw-tile__meta">
                    <span className="cw-chip">{ABILITY_SHORT[ability]}</span>
                    {primary && dndClass ? (
                      <span className="cw-chip" data-tone="accent" data-wrap="true">
                        Primär für {dndClass.name}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          {abilityNotice ? (
            <p className="cw-field__error" role="status">
              {abilityNotice}
            </p>
          ) : null}
        </fieldset>

        {/* ────────────────────── Zwei Fertigkeiten ────────────────────── */}
        <fieldset className="cw-fieldset">
          <legend className="cw-fieldset__legend">Zwei Fertigkeiten</legend>
          <p className="cw-fieldset__hint">
            In diesen beiden ist dein Charakter geübt, bevor die Klasse überhaupt
            etwas dazugibt. Sie zählen nicht gegen die Wahlen im Schritt
            „Fertigkeiten“ — dort stehen sie festgesetzt.
          </p>

          <p className="cw-field__hint" aria-live="polite">
            {counterText(value.skills.length, CUSTOM_SKILL_COUNT, "Fertigkeit", "Fertigkeiten")}
          </p>

          <div className="cw-toggles" role="group" aria-label="Fertigkeiten wählen">
            {SORTED_SKILLS.map((skill) => (
              <button
                key={skill}
                type="button"
                className="cw-toggle"
                aria-pressed={value.skills.includes(skill)}
                onClick={() => toggleSkill(skill)}
              >
                <span className="cw-toggle__mark" aria-hidden="true">
                  <NavIcon name="check" width={16} height={16} />
                </span>
                {SKILL_LABELS[skill] ?? skill}
              </button>
            ))}
          </div>

          {skillNotice ? (
            <p className="cw-field__error" role="status">
              {skillNotice}
            </p>
          ) : null}
        </fieldset>

        {/* ─────────────────────── Werkzeugkunde ─────────────────────── */}
        <fieldset className="cw-fieldset">
          <legend className="cw-fieldset__legend">Eine Werkzeugkunde</legend>
          <p className="cw-fieldset__hint">
            Ein Handwerkszeug, mit dem du geübt umgehst. Die Liste ist die der
            Handwerkszeuge aus dem Ausrüstungskapitel, ergänzt um die beiden
            Werkzeuge, die die vier SRD-Hintergründe vergeben — ein Eigenbau
            soll nicht weniger dürfen als ein Katalogeintrag.
          </p>
          <div className="cw-fields">
            <div className="cw-field" data-span="full">
              <label className="cw-field__label" htmlFor={id("tool")}>
                Werkzeug
                <span className="cw-field__required">Pflicht</span>
              </label>
              <select
                id={id("tool")}
                className="uwe-input-v3"
                value={value.toolProficiency}
                onChange={(event) => onChange({ ...value, toolProficiency: event.target.value })}
              >
                <option value="">Bitte wählen</option>
                {CUSTOM_TOOL_OPTIONS.map((tool) => (
                  <option key={tool} value={tool}>
                    {tool}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* ────────────────────── Ursprungstalent ────────────────────── */}
        <fieldset className="cw-fieldset">
          <legend className="cw-fieldset__legend">Ein Ursprungstalent</legend>
          <p className="cw-fieldset__hint">
            Das Talent ist die eigentliche Fähigkeit, die ein Hintergrund
            mitbringt — bis hin zu Zaubern für Klassen, die gar nicht zaubern
            können. Auf jeder Kachel steht, was es tut; der volle Wortlaut
            klappt darunter auf.
          </p>

          <div className="cw-grid" role="group" aria-label="Ursprungstalent wählen">
            {ORIGIN_FEATS.map((entry) => (
              <div className="cw-choice" key={entry.key}>
                <button
                  type="button"
                  className="cw-tile"
                  aria-pressed={value.originFeat === entry.key}
                  onClick={() =>
                    onChange({
                      ...value,
                      originFeat: value.originFeat === entry.key ? "" : entry.key,
                    })
                  }
                >
                  <span className="cw-tile__check" aria-hidden="true">
                    <NavIcon name="check" width={16} height={16} />
                  </span>
                  <span className="cw-tile__name">{entry.name}</span>
                  <span className="cw-tile__hook">{entry.hook}</span>
                  <span className="cw-tile__meta">
                    {entry.benefits.slice(0, 2).map((benefit) => (
                      <span key={benefit.name} className="cw-chip">
                        {benefit.name}
                      </span>
                    ))}
                    {entry.abilityIncrease ? (
                      <span className="cw-chip" data-tone="accent">
                        +1 auf ein Attribut
                      </span>
                    ) : null}
                  </span>
                </button>
                <details className="cw-disclosure">
                  <summary>Was {entry.name} genau kann</summary>
                  <FeatText feat={entry} />
                </details>
              </div>
            ))}
          </div>
        </fieldset>
      </div>

      {/* ─────────────────── Ausrüstung: 50 Goldmünzen ─────────────────── */}
      <div className="cw-note">
        <NavIcon name="coins" width={18} height={18} />
        <span className="cw-note__text">
          Ausrüstung gibt es beim Eigenbau nicht als Liste, sondern als Geld:{" "}
          <strong>{CUSTOM_BACKGROUND_GOLD} Goldmünzen</strong>, mit denen du im
          Schritt „Ausrüstung“ selbst einkaufst. Das ist der Tausch, den der
          Bauplan vorsieht — ein Katalog-Hintergrund bringt Gegenstände mit und
          dafür weniger Gold.
        </span>
      </div>

      {/* ─────────────────── Was noch fehlt / was steht ─────────────────── */}
      {problems.complete ? (
        <div className="cw-note" data-tone="accent" role="status">
          <NavIcon name="check-check" width={18} height={18} />
          <span className="cw-note__text">
            <strong>{value.name.trim()}</strong> ist fertig:{" "}
            {joinNames(value.abilityOptions.map((ability) => ABILITY_LABELS[ability]))},{" "}
            {joinNames(value.skills.map((skill) => SKILL_LABELS[skill] ?? skill))},{" "}
            {value.toolProficiency}
            {feat ? `, ${feat.name}` : ""} und {CUSTOM_BACKGROUND_GOLD} GM. Ab hier
            verhält er sich wie jeder andere Hintergrund.
          </span>
        </div>
      ) : (
        <section className="cw-todo">
          <h3 className="cw-todo__title">Das fehlt noch</h3>
          <p className="cw-todo__lede">
            {problems.issues.length === 1
              ? "Ein Punkt fehlt, dann zählt der Hintergrund als gewählt."
              : `${problems.issues.length} Punkte fehlen, dann zählt der Hintergrund als gewählt.`}{" "}
            Solange etwas offen ist, bleibt der Hintergrund in der Vorschau leer —
            ein halb gebauter darf nicht als fertiger durchgehen.
          </p>
          <ul className="cw-todo__list">
            {problems.issues.map((issue) => (
              <li className="cw-todo__item" key={issue}>
                <span className="cw-todo__text">{issue}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
