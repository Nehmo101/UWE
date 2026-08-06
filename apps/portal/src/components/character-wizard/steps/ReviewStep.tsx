"use client";

/**
 * Schritt 9 — die Übersicht.
 *
 * Hier wird nichts mehr entschieden, hier wird geprüft. Deshalb ist dieser
 * Schritt kein Formular und keine Definitionsliste, sondern ein Bogen: die
 * Zahlen stehen, wo sie auf Papier auch stünden, und wer den Ausdruck kennt,
 * findet sich ohne Suchen zurecht. Eine `<dl>` mit dreißig Zeilen wäre
 * schneller gebaut und für den Spieler wertlos — er will sehen, was er
 * gebaut hat, nicht was er eingegeben hat.
 *
 * Zwei Dinge hängen daran:
 *
 *   1. **Das Fehlende ist anklickbar.** Jede offene Prüfung bekommt eine
 *      Zeile mit dem Satz, der sagt, was fehlt, und einen Knopf, der genau
 *      dorthin springt (`goTo`). „Es fehlen noch Entscheidungen“ ohne Weg
 *      dorthin ist eine Sackgasse.
 *   2. **Der Anlegen-Knopf sagt, warum er nicht geht.** Ein grauer Knopf
 *      ohne Begründung ist die häufigste Stelle, an der ein Ersteller
 *      verlassen wird.
 *
 * Der Entwurf geht als eine JSON-Zeichenkette an die Server Action —
 * `{ worldSlug, draft }`, damit die Aktion ohne Bindung an die Route weiß,
 * in welcher Welt sie anlegt. Serverseitig wird alles noch einmal geprüft;
 * diese Seite ist Komfort, keine Sicherung.
 */

import { useState } from "react";
import {
  ABILITIES,
  ABILITY_LABELS,
  ABILITY_SHORT,
  findAlignment,
  findFeat,
  findLanguage,
  findSpell,
  formatModifier,
  stepMeta,
  type AbilityKey,
  type CharacterDetails,
  type EquipmentLine,
  type StepValidation,
  type Trait,
} from "@uwe/character-creator";

import { Button } from "@/src/components/ui/button";
import { NavIcon } from "@/src/components/ui/icon";
import { SKILL_LABELS } from "../CharacterRail";
import { clearStoredDraft } from "../useDraft";
import type { StepProps } from "../types";

/** Ein Block des Bogens. `wide` läuft über alle Spalten. */
function SheetBlock({
  title,
  span,
  children,
}: {
  title: string;
  span?: "wide";
  children: React.ReactNode;
}) {
  return (
    <section className="cw-sheet__block" data-span={span}>
      <h3 className="cw-sheet__block-title">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="cw-sheet__row">
      <span className="cw-sheet__row-label">{label}</span>
      <span className="cw-sheet__row-value">{value}</span>
    </li>
  );
}

function Vital({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div className="cw-vital">
      <span className="cw-vital__value" data-empty={value === null}>
        {value === null ? "—" : `${value}${suffix ?? ""}`}
      </span>
      <span className="cw-vital__label">{label}</span>
    </div>
  );
}

/** Merkmale mit Regeltext: erst die Namen, das Kleingedruckte auf Wunsch. */
function TraitList({ traits }: { traits: Array<{ origin: string; trait: Trait }> }) {
  if (traits.length === 0) {
    return <p className="cw-sheet__empty">Noch keine Merkmale — Volk und Klasse bringen sie mit.</p>;
  }
  return (
    <div>
      <ul className="cw-sheet__list">
        {traits.map(({ origin, trait }) => (
          <li className="cw-sheet__row" key={`${origin}-${trait.name}`}>
            <span className="cw-sheet__row-label">{trait.name}</span>
            <span className="cw-sheet__row-value">{origin}</span>
          </li>
        ))}
      </ul>
      <details className="cw-disclosure">
        <summary>Regeltext aller Merkmale</summary>
        <div className="cw-prose">
          {traits.map(({ origin, trait }) => (
            <p key={`text-${origin}-${trait.name}`}>
              <strong>{trait.name}</strong> — {trait.description}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}

/** Die Freitextfelder, die tatsächlich ausgefüllt wurden. */
const DETAIL_LABELS: Array<[keyof CharacterDetails, string]> = [
  ["appearance", "Auftreten"],
  ["personality", "Persönlichkeit"],
  ["ideals", "Ideale"],
  ["bonds", "Bindungen"],
  ["flaws", "Makel"],
  ["backstory", "Vorgeschichte"],
];

const PROFILE_LABELS: Array<[keyof CharacterDetails, string]> = [
  ["pronouns", "Anrede"],
  ["age", "Alter"],
  ["height", "Größe"],
  ["weight", "Gewicht"],
  ["eyes", "Augen"],
  ["hair", "Haare"],
  ["skin", "Haut"],
];

/**
 * Hat Next.js die Server Action mit einer Weiterleitung beantwortet?
 *
 * `redirect()` reist als geworfener Wert mit einem `digest`-Feld zurück. Wir
 * fangen ihn nur, um den Entwurf aufzuräumen, und werfen ihn sofort weiter —
 * verschluckt hieße: Anlegen erfolgreich, Seite bleibt stehen.
 */
function isNavigationSignal(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const { digest } = error;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Der Charakter konnte nicht angelegt werden. Bitte versuche es noch einmal.";
}

export function ReviewStep({
  draft,
  resolved,
  preview,
  goTo,
  worldSlug,
  createAction,
  allValidations,
}: StepProps) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const { species, lineage, dndClass, subclass, background } = resolved;

  const outstanding: StepValidation[] = allValidations.filter(
    (entry) => !entry.complete && !entry.skipped && entry.step !== "review",
  );
  const ready = outstanding.length === 0;

  const alignment = draft.alignmentKey ? (findAlignment(draft.alignmentKey) ?? null) : null;
  const originFeat = background ? (findFeat(background.originFeat) ?? null) : null;

  const equipmentOption =
    dndClass?.startingEquipment.find((option) => option.key === draft.equipmentChoice) ?? null;
  const goldOnly = draft.equipmentChoice === "gold";
  const equipmentLines: EquipmentLine[] = equipmentOption?.items ?? [];
  // Dieselbe Rechnung wie beim Anlegen (`createFullCharacter`): die Wahl der
  // Klasse plus das, was der Hintergrund ohnehin mitgibt.
  const startingGold =
    (goldOnly ? (dndClass?.startingGoldAlternative ?? 0) : (equipmentOption?.gold ?? 0)) +
    (background?.startingGold ?? 0);

  const traits: Array<{ origin: string; trait: Trait }> = [
    ...(species?.traits ?? []).map((trait) => ({ origin: species?.name ?? "Volk", trait })),
    ...(lineage?.traits ?? []).map((trait) => ({ origin: lineage?.name ?? "Abstammung", trait })),
    ...(dndClass?.features ?? []).map((trait) => ({ origin: dndClass?.name ?? "Klasse", trait })),
    ...(subclass?.features ?? []).map((trait) => ({ origin: subclass?.name ?? "Spezialisierung", trait })),
  ];

  const cantripNames = draft.cantrips.map((key) => findSpell(key)?.name ?? key);
  const spellNames = draft.spells.map((key) => findSpell(key)?.name ?? key);
  const languageNames = draft.languages.map((key) => findLanguage(key)?.name ?? key);

  const descriptors = [
    lineage?.name ?? species?.name,
    subclass ? `${dndClass?.name} (${subclass.name})` : dndClass?.name,
    background?.name,
  ].filter((part): part is string => Boolean(part));

  const filledProfile = PROFILE_LABELS.filter(([key]) => draft.details[key].trim().length > 0);
  const filledTexts = DETAIL_LABELS.filter(([key]) => draft.details[key].trim().length > 0);

  const blockedReason = !ready
    ? `Noch offen: ${outstanding.map((entry) => stepMeta(entry.step).label).join(", ")}.`
    : null;

  async function handleCreate() {
    setPending(true);
    setFailure(null);
    try {
      await createAction(JSON.stringify({ worldSlug, draft }));
      clearStoredDraft(worldSlug);
    } catch (error) {
      if (isNavigationSignal(error)) {
        clearStoredDraft(worldSlug);
        throw error;
      }
      setFailure(errorMessage(error));
      setPending(false);
    }
  }

  return (
    <div className="cw-sheet">
      {/* ───────────────────────── Der Kopf des Bogens ───────────────────────── */}
      <header className="cw-sheet__banner">
        <p className="cw-sheet__name">{draft.name.trim() || "Namenlos"}</p>
        <p className="cw-sheet__lede">
          Stufe 1{descriptors.length > 0 ? ` · ${descriptors.join(" · ")}` : ""}
        </p>
        <div className="cw-sheet__marks">
          {alignment ? <span className="cw-chip" data-tone="accent">{alignment.name}</span> : null}
          {draft.details.pronouns.trim() ? (
            <span className="cw-chip">{draft.details.pronouns.trim()}</span>
          ) : null}
          <span className="cw-chip">
            Übungsbonus <span className="cw-chip__value">+{preview.proficiencyBonus}</span>
          </span>
          {preview.hitDie !== null ? (
            <span className="cw-chip">
              Trefferwürfel <span className="cw-chip__value">W{preview.hitDie}</span>
            </span>
          ) : null}
        </div>
      </header>

      <div className="cw-vitals" data-columns="4">
        <Vital label="Trefferpunkte" value={preview.hitPoints} />
        <Vital label="Rüstungsklasse" value={preview.armorClass} />
        <Vital label="Initiative" value={preview.initiative} />
        <Vital label="Tempo" value={preview.speed} suffix=" ft" />
      </div>

      <div className="cw-sheet__grid">
        {/* ───────────────────────── Attribute ───────────────────────── */}
        <SheetBlock title="Attribute" span="wide">
          <div className="cw-abilities">
            {ABILITIES.map((ability: AbilityKey) => (
              <div className="cw-ability" key={ability} title={ABILITY_LABELS[ability]}>
                <span className="cw-ability__short">{ABILITY_SHORT[ability]}</span>
                <span className="cw-ability__mod">
                  {draft.abilities ? formatModifier(preview.modifiers[ability]) : "—"}
                </span>
                <span className="cw-ability__score">
                  {draft.abilities ? preview.scores[ability] : "—"}
                </span>
              </div>
            ))}
          </div>
        </SheetBlock>

        {/* ───────────────────────── Rettungswürfe ───────────────────────── */}
        <SheetBlock title="Rettungswürfe">
          <ul className="cw-sheet__list">
            {ABILITIES.map((ability: AbilityKey) => {
              const proficient = preview.savingThrows.includes(ability);
              const value = preview.modifiers[ability] + (proficient ? preview.proficiencyBonus : 0);
              return (
                <Row
                  key={ability}
                  label={proficient ? `${ABILITY_LABELS[ability]} (geübt)` : ABILITY_LABELS[ability]}
                  value={draft.abilities ? formatModifier(value) : "—"}
                />
              );
            })}
          </ul>
        </SheetBlock>

        {/* ───────────────────────── Fertigkeiten ───────────────────────── */}
        <SheetBlock title="Geübte Fertigkeiten">
          {preview.skillProficiencies.length === 0 ? (
            <p className="cw-sheet__empty">Noch keine — Klasse und Hintergrund vergeben sie.</p>
          ) : (
            <div className="cw-toggles">
              {[...preview.skillProficiencies]
                .map((skill) => SKILL_LABELS[skill] ?? skill)
                .sort((a, b) => a.localeCompare(b, "de"))
                .map((label) => (
                  <span className="cw-chip" data-tone="accent" key={label}>
                    {label}
                  </span>
                ))}
            </div>
          )}
          <ul className="cw-sheet__list">
            <Row
              label="Passive Wahrnehmung"
              value={preview.passivePerception === null ? "—" : String(preview.passivePerception)}
            />
          </ul>
        </SheetBlock>

        {/* ───────────────────────── Volk & Hintergrund ───────────────────────── */}
        <SheetBlock title="Herkunft">
          <ul className="cw-sheet__list">
            <Row label="Volk" value={species?.name ?? "—"} />
            {species?.lineages?.length ? (
              <Row label={species.lineageLabel ?? "Abstammung"} value={lineage?.name ?? "—"} />
            ) : null}
            <Row label="Größe" value={species ? SIZE_LABELS[species.size] : "—"} />
            <Row
              label="Dunkelsicht"
              value={preview.darkvision ? `${preview.darkvision} ft` : "keine"}
            />
            <Row label="Hintergrund" value={background?.name ?? "—"} />
            <Row label="Ursprungstalent" value={originFeat?.name ?? background?.originFeat ?? "—"} />
            {background?.toolProficiency ? (
              <Row label="Werkzeug" value={background.toolProficiency} />
            ) : null}
          </ul>
        </SheetBlock>

        {/* ───────────────────────── Klasse ───────────────────────── */}
        <SheetBlock title="Klasse">
          <ul className="cw-sheet__list">
            <Row label="Klasse" value={dndClass ? `${dndClass.name} · Stufe 1` : "—"} />
            {subclass ? (
              <Row label={dndClass?.subclassLabel ?? "Spezialisierung"} value={subclass.name} />
            ) : null}
            <Row label="Rüstung" value={dndClass?.armorProficiencies.join(", ") || "keine"} />
            <Row label="Waffen" value={dndClass?.weaponProficiencies.join(", ") || "keine"} />
            {dndClass?.toolProficiencies.length ? (
              <Row label="Werkzeuge" value={dndClass.toolProficiencies.join(", ")} />
            ) : null}
          </ul>
        </SheetBlock>

        {/* ───────────────────────── Ausrüstung ───────────────────────── */}
        <SheetBlock title="Ausrüstung">
          {goldOnly ? (
            <p className="cw-sheet__text">
              Du ziehst ohne Paket los und kaufst selbst ein.
            </p>
          ) : equipmentLines.length === 0 ? (
            <p className="cw-sheet__empty">Noch nichts gewählt.</p>
          ) : (
            <ul className="cw-sheet__list">
              {equipmentLines.map((line) => (
                <Row
                  key={line.name}
                  label={line.name}
                  value={line.quantity > 1 ? `${line.quantity}×` : "1×"}
                />
              ))}
            </ul>
          )}
          {background?.equipment.length ? (
            <ul className="cw-sheet__list">
              {background.equipment.map((entry) => (
                <Row key={`bg-${entry}`} label={entry} value="Hintergrund" />
              ))}
            </ul>
          ) : null}
          <ul className="cw-sheet__list">
            <Row label="Startgold" value={`${startingGold} GM`} />
          </ul>
        </SheetBlock>

        {/* ───────────────────────── Zauber ───────────────────────── */}
        {dndClass?.spellcasting ? (
          <SheetBlock title="Zauberei">
            <ul className="cw-sheet__list">
              <Row
                label="Zauberattribut"
                value={ABILITY_LABELS[dndClass.spellcasting.ability]}
              />
              <Row
                label="Schwierigkeitsgrad"
                value={preview.spellSaveDc === null ? "—" : String(preview.spellSaveDc)}
              />
              <Row
                label="Zauberangriff"
                value={
                  preview.spellAttackBonus === null
                    ? "—"
                    : formatModifier(preview.spellAttackBonus)
                }
              />
            </ul>
            <p className="cw-sheet__block-title">Zaubertricks</p>
            {cantripNames.length === 0 ? (
              <p className="cw-sheet__empty">Keine gewählt.</p>
            ) : (
              <div className="cw-toggles">
                {cantripNames.map((name) => (
                  <span className="cw-chip" key={`cantrip-${name}`}>
                    {name}
                  </span>
                ))}
              </div>
            )}
            <p className="cw-sheet__block-title">Zauber des 1. Grades</p>
            {spellNames.length === 0 ? (
              <p className="cw-sheet__empty">Keine gewählt.</p>
            ) : (
              <div className="cw-toggles">
                {spellNames.map((name) => (
                  <span className="cw-chip" key={`spell-${name}`}>
                    {name}
                  </span>
                ))}
              </div>
            )}
          </SheetBlock>
        ) : null}

        {/* ───────────────────────── Merkmale ───────────────────────── */}
        <SheetBlock title="Merkmale" span="wide">
          <TraitList traits={traits} />
        </SheetBlock>

        {/* ───────────────────────── Beschreibung ───────────────────────── */}
        <SheetBlock title="Beschreibung" span="wide">
          {filledProfile.length === 0 && filledTexts.length === 0 && languageNames.length === 0 ? (
            <p className="cw-sheet__empty">
              Noch nichts eingetragen — der Schritt „Beschreibung“ wartet auf dich.
            </p>
          ) : null}
          {languageNames.length > 0 ? (
            <div className="cw-toggles">
              {languageNames.map((name) => (
                <span className="cw-chip" key={`lang-${name}`}>
                  {name}
                </span>
              ))}
            </div>
          ) : null}
          {filledProfile.length > 0 ? (
            <ul className="cw-sheet__list">
              {filledProfile.map(([key, label]) => (
                <Row key={key} label={label} value={draft.details[key].trim()} />
              ))}
            </ul>
          ) : null}
          {filledTexts.map(([key, label]) => (
            <div key={key}>
              <p className="cw-sheet__block-title">{label}</p>
              <p className="cw-sheet__text">{draft.details[key].trim()}</p>
            </div>
          ))}
        </SheetBlock>
      </div>

      {/* ───────────────────────── Was noch fehlt ───────────────────────── */}
      {outstanding.length > 0 ? (
        <section className="cw-todo">
          <h3 className="cw-todo__title">Das fehlt noch</h3>
          <p className="cw-todo__lede">
            {outstanding.length === 1
              ? "Eine Entscheidung fehlt, dann kann der Charakter angelegt werden."
              : `${outstanding.length} Entscheidungen fehlen, dann kann der Charakter angelegt werden.`}
          </p>
          <ul className="cw-todo__list">
            {outstanding.map((entry) => {
              const meta = stepMeta(entry.step);
              return (
                <li className="cw-todo__item" key={entry.step}>
                  <span className="cw-todo__text">
                    <span className="cw-todo__step">{meta.label}</span>
                    {entry.issues[0] ?? meta.summary}
                  </span>
                  <Button variant="outline" onClick={() => goTo(entry.step)}>
                    Dorthin springen
                    <NavIcon name="arrow-right" width={16} height={16} />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ───────────────────────── Anlegen ───────────────────────── */}
      {failure ? (
        <p className="cw-alert" role="alert">
          {failure}
        </p>
      ) : null}

      <div className="cw-submit">
        <span className="cw-submit__reason">
          {pending
            ? "Der Charakter wird angelegt — Seite, Bogen und Ausrüstung entstehen zusammen."
            : (blockedReason ??
              "Alles steht. Der Charakter bekommt eine eigene Wiki-Seite, die nur du beschreiben kannst.")}
        </span>
        <Button onClick={handleCreate} disabled={!ready || pending}>
          <NavIcon name="check-check" width={16} height={16} />
          {pending ? "Wird angelegt …" : "Charakter anlegen"}
        </Button>
      </div>
    </div>
  );
}

const SIZE_LABELS: Record<string, string> = {
  tiny: "Winzig",
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
};
