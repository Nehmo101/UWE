"use client";

/**
 * Schritt 8 — die Beschreibung.
 *
 * Der einzige Schritt ohne Regelwirkung: keine Zahl ändert sich, nichts wird
 * gegen ein Budget gerechnet. Genau deshalb ist er der gefährlichste. Ein
 * Feld nach dem anderen in einer Spalte, dreizehn Stück, und der Spieler
 * füllt den Namen aus und klickt weiter — der Rest bleibt leer und der
 * Charakter bleibt ein Zahlenblatt.
 *
 * Also drei Gruppen mit je einer eigenen Frage:
 *
 *   1. **Wer ist das?** Name, Anrede, Gesinnung, Sprachen — die Angaben, die
 *      am Tisch fallen, bevor jemand würfelt.
 *   2. **Wie sieht er aus?** Die sechs Steckbriefzahlen plus ein Absatz.
 *   3. **Was treibt ihn?** Die vier Bögen aus dem Spielerhandbuch und die
 *      Vorgeschichte.
 *
 * Blockierend ist genau ein Feld: der Name. Alles andere darf leer bleiben —
 * ein Charakter, der am Tisch entsteht, ist mehr wert als einer, der an
 * einem Pflichtfeld gestorben ist. Die Hilfstexte stehen trotzdem da und
 * fragen konkret, statt „Beschreibung" über ein leeres Kästchen zu schreiben.
 */

import { useId } from "react";
import {
  ALIGNMENTS,
  LANGUAGES,
  type Alignment,
  type CharacterDetails,
  type Language,
} from "@uwe/character-creator";

import { NavIcon } from "@/src/components/ui/icon";
import { Input, Textarea } from "@/src/components/ui/input";
import type { StepProps } from "../types";

/**
 * Der Katalog wird einmal an seinen Vertrag gebunden.
 *
 * Beide Listen werden hier durchlaufen; ohne Annotation hinge der Typ der
 * Rückrufparameter am Auflösungspfad des Barrels. Eine Zeile hier ist
 * billiger als sechs `as`-Ausdrücke unten.
 */
const ALIGNMENT_OPTIONS: Alignment[] = ALIGNMENTS;
const LANGUAGE_OPTIONS: Language[] = LANGUAGES;

/** Ein kurzes Steckbriefzahlenfeld — Alter, Größe, Augen. */
interface ShortFieldSpec {
  key: keyof CharacterDetails;
  label: string;
  placeholder: string;
  /** Der Halbsatz, der sagt, was hier hineingehört. */
  hint?: string;
}

const APPEARANCE_FIELDS: ShortFieldSpec[] = [
  { key: "age", label: "Alter", placeholder: "z. B. 27 Winter" },
  { key: "height", label: "Größe", placeholder: "z. B. 1,72 m" },
  { key: "weight", label: "Gewicht", placeholder: "z. B. 68 kg" },
  { key: "eyes", label: "Augen", placeholder: "z. B. bernsteinfarben" },
  { key: "hair", label: "Haare", placeholder: "z. B. rot, kurz geschoren" },
  { key: "skin", label: "Haut", placeholder: "z. B. sonnengegerbt" },
];

/** Die vier Bögen des Spielerhandbuchs, jeder mit seiner eigenen Frage. */
const CHARACTER_FIELDS: ShortFieldSpec[] = [
  {
    key: "personality",
    label: "Persönlichkeit",
    placeholder: "Ich rede zu viel, wenn mir etwas unangenehm ist.",
    hint: "Zwei Eigenheiten, an denen man ihn am Tisch wiedererkennt.",
  },
  {
    key: "ideals",
    label: "Ideale",
    placeholder: "Niemand bleibt zurück.",
    hint: "Wofür er einsteht, auch wenn es teuer wird.",
  },
  {
    key: "bonds",
    label: "Bindungen",
    placeholder: "Meine Schwester wartet in Sturmhafen auf Nachricht.",
    hint: "Wer oder was ihn zurück in die Welt zieht.",
  },
  {
    key: "flaws",
    label: "Makel",
    placeholder: "Ich kann kein offenes Angebot ausschlagen.",
    hint: "Der Hebel, an dem der Spielleiter ziehen darf.",
  },
];

export function DetailsStep({ draft, set, validation }: StepProps) {
  const fieldId = useId();
  const id = (suffix: string) => `${fieldId}-${suffix}`;

  const setDetail = (key: keyof CharacterDetails, value: string) => {
    set("details", { ...draft.details, [key]: value });
  };

  const toggleLanguage = (key: string) => {
    const chosen = draft.languages.includes(key)
      ? draft.languages.filter((entry) => entry !== key)
      : [...draft.languages, key];
    set("languages", chosen);
  };

  const nameMissing = draft.name.trim().length === 0;
  const standardLanguages = LANGUAGE_OPTIONS.filter((entry) => entry.rarity === "standard");
  const rareLanguages = LANGUAGE_OPTIONS.filter((entry) => entry.rarity === "rare");

  const languageGroup = (label: string, hint: string, entries: Language[]) => (
    <div role="group" aria-label={label}>
      <p className="cw-field__hint">{hint}</p>
      <div className="cw-toggles">
        {entries.map((language) => {
          const active = draft.languages.includes(language.key);
          return (
            <button
              key={language.key}
              type="button"
              className="cw-toggle"
              aria-pressed={active}
              onClick={() => toggleLanguage(language.key)}
              title={language.script ? `Schrift: ${language.script}` : undefined}
            >
              <span className="cw-toggle__mark" aria-hidden="true">
                <NavIcon name="check" width={16} height={16} />
              </span>
              {language.name}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="cw-form">
      {/* ───────────────────────── Wer ist das? ───────────────────────── */}
      <fieldset className="cw-fieldset">
        <legend className="cw-fieldset__legend">Wer ist das?</legend>
        <p className="cw-fieldset__hint">
          Der Name fällt am Tisch hundertmal pro Abend — alles andere hier ist
          freiwillig und darf später wachsen.
        </p>

        <div className="cw-fields">
          <div className="cw-field" data-span="full">
            <label className="cw-field__label" htmlFor={id("name")}>
              Name
              <span className="cw-field__required">Pflicht</span>
            </label>
            <Input
              id={id("name")}
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="z. B. Yrsa Falkenhand"
              maxLength={120}
              autoComplete="off"
              required
              aria-invalid={nameMissing}
              aria-describedby={nameMissing ? id("name-error") : undefined}
            />
            {nameMissing ? (
              <p className="cw-field__error" id={id("name-error")}>
                Dein Charakter braucht einen Namen.
              </p>
            ) : null}
          </div>

          <div className="cw-field">
            <label className="cw-field__label" htmlFor={id("pronouns")}>
              Anrede
            </label>
            <Input
              id={id("pronouns")}
              value={draft.details.pronouns}
              onChange={(event) => setDetail("pronouns", event.target.value)}
              placeholder="z. B. sie/ihr"
              maxLength={120}
              autoComplete="off"
            />
            <p className="cw-field__hint">Wie am Tisch über deinen Charakter gesprochen wird.</p>
          </div>
        </div>
      </fieldset>

      {/* ───────────────────────── Gesinnung ───────────────────────── */}
      <fieldset className="cw-fieldset">
        <legend className="cw-fieldset__legend">Gesinnung</legend>
        <p className="cw-fieldset__hint">
          Kein Regelkorsett, sondern eine Ansage, wie dein Charakter auf eine
          unangenehme Entscheidung reagiert. Nochmaliges Antippen hebt die Wahl
          wieder auf.
        </p>

        <div className="cw-grid" data-density="compact">
          {ALIGNMENT_OPTIONS.map((alignment) => {
            const selected = draft.alignmentKey === alignment.key;
            return (
              <button
                key={alignment.key}
                type="button"
                className="cw-tile"
                aria-pressed={selected}
                onClick={() => set("alignmentKey", selected ? null : alignment.key)}
              >
                <span className="cw-tile__check" aria-hidden="true">
                  <NavIcon name="check" width={16} height={16} />
                </span>
                <span className="cw-tile__name">{alignment.name}</span>
                <span className="cw-tile__hook">{alignment.hook}</span>
                <span className="cw-tile__meta">
                  <span className="cw-chip">{alignment.nameEn}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ───────────────────────── Sprachen ───────────────────────── */}
      <fieldset className="cw-fieldset">
        <legend className="cw-fieldset__legend">Sprachen</legend>
        <p className="cw-fieldset__hint">
          Gemeinsprache versteht ohnehin jeder. Was du hier zusätzlich
          auswählst, steht später als Fertigkeit auf deinem Bogen — und
          entscheidet, wen du im Hafen ansprechen kannst.
        </p>

        <div className="cw-form">
          {standardLanguages.length > 0
            ? languageGroup(
                "Verbreitete Sprachen",
                "Verbreitet — in fast jeder Stadt trifft man jemanden, der sie spricht.",
                standardLanguages,
              )
            : null}
          {rareLanguages.length > 0
            ? languageGroup(
                "Seltene Sprachen",
                "Selten — wer sie spricht, fällt auf. Genau das kann der Punkt sein.",
                rareLanguages,
              )
            : null}
          {LANGUAGE_OPTIONS.length === 0 ? (
            <p className="cw-sheet__empty">Für diese Welt sind keine Sprachen hinterlegt.</p>
          ) : null}
        </div>
      </fieldset>

      {/* ───────────────────────── Wie sieht er aus? ───────────────────────── */}
      <fieldset className="cw-fieldset">
        <legend className="cw-fieldset__legend">Wie sieht er aus?</legend>
        <p className="cw-fieldset__hint">
          Sechs Angaben, die auf jedem Steckbrief stehen — und ein Absatz für
          das eine Merkmal, das man sich merkt.
        </p>

        <div className="cw-fields">
          {APPEARANCE_FIELDS.map((field) => (
            <div className="cw-field" key={field.key}>
              <label className="cw-field__label" htmlFor={id(field.key)}>
                {field.label}
              </label>
              <Input
                id={id(field.key)}
                value={draft.details[field.key]}
                onChange={(event) => setDetail(field.key, event.target.value)}
                placeholder={field.placeholder}
                maxLength={120}
                autoComplete="off"
              />
            </div>
          ))}

          <div className="cw-field" data-span="full">
            <label className="cw-field__label" htmlFor={id("appearance")}>
              Auftreten
            </label>
            <Textarea
              id={id("appearance")}
              value={draft.details.appearance}
              onChange={(event) => setDetail("appearance", event.target.value)}
              placeholder="Die Narbe über dem linken Auge, der Gang, die Art, wie er den Raum betritt."
              maxLength={5000}
              rows={4}
            />
            <p className="cw-field__hint">
              Woran erkennt die Gruppe deinen Charakter aus zwanzig Schritt Entfernung?
            </p>
          </div>
        </div>
      </fieldset>

      {/* ───────────────────────── Was treibt ihn? ───────────────────────── */}
      <fieldset className="cw-fieldset">
        <legend className="cw-fieldset__legend">Was treibt ihn?</legend>
        <p className="cw-fieldset__hint">
          Vier kurze Sätze reichen. Sie sind der Vorrat, aus dem der
          Spielleiter Szenen baut — leer gelassen, bekommst du die Szenen der
          anderen.
        </p>

        <div className="cw-fields">
          {CHARACTER_FIELDS.map((field) => (
            <div className="cw-field" key={field.key}>
              <label className="cw-field__label" htmlFor={id(field.key)}>
                {field.label}
              </label>
              <Textarea
                id={id(field.key)}
                value={draft.details[field.key]}
                onChange={(event) => setDetail(field.key, event.target.value)}
                placeholder={field.placeholder}
                maxLength={5000}
                rows={3}
              />
              {field.hint ? <p className="cw-field__hint">{field.hint}</p> : null}
            </div>
          ))}

          <div className="cw-field" data-span="full">
            <label className="cw-field__label" htmlFor={id("backstory")}>
              Vorgeschichte
            </label>
            <Textarea
              id={id("backstory")}
              value={draft.details.backstory}
              onChange={(event) => setDetail("backstory", event.target.value)}
              placeholder="Woher er kommt, was ihn fortgetrieben hat, wer ihn noch sucht."
              maxLength={5000}
              rows={6}
            />
            <p className="cw-field__hint">
              Ein Absatz genügt. Alles Weitere schreibt sich am Tisch von selbst.
            </p>
          </div>
        </div>
      </fieldset>

      {validation.issues.length > 0 ? (
        <p className="cw-field__error" role="status">
          {validation.issues[0]}
        </p>
      ) : null}
    </div>
  );
}
