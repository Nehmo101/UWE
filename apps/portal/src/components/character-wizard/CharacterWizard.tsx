"use client";

/**
 * Das Gerüst des Charakter-Erstellers.
 *
 * Es hält den Entwurf, löst den Katalog auf, rechnet die Vorschau und
 * entscheidet, welcher Schritt sichtbar ist. Die Schritte selbst wissen
 * nichts voneinander — sie bekommen `StepProps` und geben Änderungen
 * zurück. Das ist der Grund, warum ein neuer Schritt hier genau zwei
 * Zeilen kostet: ein Eintrag in `STEP_COMPONENTS`.
 *
 * Navigation ist absichtlich **nicht** linear. D&D-Erstellung ist ein
 * Netz, kein Trichter: Wer die Attribute kennt, bevor er die Klasse wählt,
 * darf vorspringen. Gesperrt ist nur das Anlegen am Ende.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CREATOR_STEPS,
  derivePreview,
  originFeats,
  resolveBackground,
  findClass,
  findLineage,
  findSpecies,
  findSubclass,
  STEP_META,
  validateDraft,
  type CreatorStepKey,
} from "@uwe/character-creator";

import { Button } from "@/src/components/ui/button";
import { NavIcon } from "@/src/components/ui/icon";
import { useDraft } from "./useDraft";
import { CharacterRail } from "./CharacterRail";
import type { ResolvedCatalog, StepProps } from "./types";
import { SpeciesStep } from "./steps/SpeciesStep";
import { ClassStep } from "./steps/ClassStep";
import { BackgroundStep } from "./steps/BackgroundStep";
import { AbilitiesStep } from "./steps/AbilitiesStep";
import { SkillsStep } from "./steps/SkillsStep";
import { EquipmentStep } from "./steps/EquipmentStep";
import { SpellsStep } from "./steps/SpellsStep";
import { DetailsStep } from "./steps/DetailsStep";
import { ReviewStep } from "./steps/ReviewStep";
import "./wizard.css";

const STEP_COMPONENTS: Record<CreatorStepKey, (props: StepProps) => React.JSX.Element> = {
  species: SpeciesStep,
  class: ClassStep,
  background: BackgroundStep,
  abilities: AbilitiesStep,
  skills: SkillsStep,
  equipment: EquipmentStep,
  spells: SpellsStep,
  details: DetailsStep,
  review: ReviewStep,
};

export interface CharacterWizardProps {
  worldSlug: string;
  /** Server Action, die den fertigen Entwurf anlegt. */
  createAction: (payload: string) => Promise<void>;
}

export function CharacterWizard({ worldSlug, createAction }: CharacterWizardProps) {
  const { draft, set, patch, restored, reset } = useDraft(worldSlug);
  const [step, setStep] = useState<CreatorStepKey>("species");
  const [confirmReset, setConfirmReset] = useState(false);

  const resolved: ResolvedCatalog = useMemo(() => {
    const species = draft.speciesKey ? (findSpecies(draft.speciesKey) ?? null) : null;
    const dndClass = draft.classKey ? (findClass(draft.classKey) ?? null) : null;
    return {
      species,
      lineage:
        draft.speciesKey && draft.lineageKey
          ? (findLineage(draft.speciesKey, draft.lineageKey) ?? null)
          : null,
      dndClass,
      subclass:
        draft.classKey && draft.subclassKey
          ? (findSubclass(draft.classKey, draft.subclassKey) ?? null)
          : null,
      // Über den Auflöser, nicht über `findBackground`: ein selbst gebauter
      // Hintergrund steht nicht im Katalog, sondern im Entwurf.
      background: resolveBackground(draft),
    };
    // `resolveBackground` liest den ganzen Entwurf (der Eigenbau steht darin),
    // deshalb hängt die Auflösung am Entwurf und nicht an einzelnen Feldern.
  }, [draft]);

  const preview = useMemo(
    () =>
      derivePreview({
        draft,
        species: resolved.species,
        lineage: resolved.lineage,
        dndClass: resolved.dndClass,
        background: resolved.background,
      }),
    [draft, resolved],
  );

  const validations = useMemo(
    () =>
      validateDraft({
        draft,
        species: resolved.species,
        dndClass: resolved.dndClass,
        background: resolved.background,
        originFeats: originFeats(),
      }),
    [draft, resolved],
  );

  const validationFor = useCallback(
    (key: CreatorStepKey) =>
      validations.find((entry) => entry.step === key) ?? {
        step: key,
        complete: false,
        issues: [],
        skipped: false,
      },
    [validations],
  );

  /**
   * Der Schritt steht im Fragment (`#klasse`).
   *
   * Damit ist jeder Schritt verlinkbar, der Zurück-Knopf des Browsers tut
   * das Erwartete, und ein Neuladen landet wieder dort, wo man war — der
   * Entwurf liegt ohnehin im sessionStorage. Bewusst das Fragment und nicht
   * `?schritt=`: `useSearchParams` verlangt eine Suspense-Grenze, und der
   * Schritt ist reiner Anzeigezustand, der den Server nichts angeht.
   */
  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash.replace(/^#/, "");
      if ((CREATOR_STEPS as readonly string[]).includes(raw)) {
        setStep(raw as CreatorStepKey);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const goTo = useCallback((next: string) => {
    if (!(CREATOR_STEPS as readonly string[]).includes(next)) return;
    setStep(next as CreatorStepKey);
    if (window.location.hash !== `#${next}`) {
      window.history.pushState(null, "", `#${next}`);
    }
    // Der Schrittwechsel soll oben beginnen — sonst steht man mitten in
    // einer Kachelwand und hält es für einen Ladefehler.
    document.getElementById("cw-panel-top")?.scrollIntoView({ block: "start" });
    // Und der aktive Schritt muss in der Leiste sichtbar sein. Ohne das steht
    // man auf Schritt 9, während die Leiste noch Schritt 1 zeigt, und die
    // einzige Positionsangabe ist die Textzeile darüber.
    requestAnimationFrame(() => {
      document
        .querySelector(`.cw-step[data-step="${next}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "center" });
    });
  }, []);

  const currentIndex = CREATOR_STEPS.indexOf(step);
  const meta = STEP_META[currentIndex];
  const StepComponent = STEP_COMPONENTS[step];
  const currentValidation = validationFor(step);

  const stepProps: StepProps = {
    draft,
    set,
    patch,
    resolved,
    preview,
    validation: currentValidation,
    goTo,
    worldSlug,
    createAction,
    allValidations: validations,
  };

  const previousStep = currentIndex > 0 ? CREATOR_STEPS[currentIndex - 1] : null;
  const nextStep =
    currentIndex < CREATOR_STEPS.length - 1 ? CREATOR_STEPS[currentIndex + 1] : null;

  return (
    <div className="cw">
      {/*
        Die Schrittleiste steht als eigene Rasterzeile über BEIDEN Spalten.
        Lag sie in der linken Spalte, endete sie an der Vorschau-Leiste und
        schnitt die letzten Schritte mitten im Wort ab („Ausrü…") — sichtbar
        war nur, dass etwas fehlt, nicht was.
      */}
      <nav className="cw-steps" aria-label="Schritte der Charaktererstellung">
          {STEP_META.map((entry, index) => {
            const validation = validationFor(entry.key);
            const state =
              entry.key === step
                ? "current"
                : validation.skipped
                  ? "skipped"
                  : validation.complete
                    ? "done"
                    : "todo";
            return (
              <button
                key={entry.key}
                type="button"
                className="cw-step"
                data-step={entry.key}
                data-state={state}
                aria-current={entry.key === step ? "step" : undefined}
                onClick={() => goTo(entry.key)}
              >
                <span className="cw-step__index" aria-hidden="true">
                  {validation.complete && entry.key !== step ? "✓" : index + 1}
                </span>
                {entry.label}
              </button>
            );
          })}
      </nav>

      <div className="cw-main">
        <div id="cw-panel-top" />

        {/*
          `role="status"` statt eines stummen Chips: Wer den Bildschirm nicht
          sieht, erfährt sonst nie, dass hier ein halb gebauter Charakter aus
          einer früheren Sitzung steht — und wundert sich über gefüllte Felder.

          „Neu beginnen" fragt nach. Ein Klick daneben hat vorher zehn
          Entscheidungen gelöscht, unwiderruflich und ohne Rückfrage.
        */}
        {restored ? (
          <div className="cw-restored" role="status">
            <NavIcon name="rotate-ccw" width={16} height={16} aria-hidden="true" />
            <span>Entwurf aus dieser Sitzung wiederhergestellt.</span>
            {confirmReset ? (
              <span className="cw-restored__confirm">
                Wirklich alles verwerfen?
                <Button size="sm" variant="destructive" onClick={reset}>
                  Verwerfen
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                  Behalten
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
                Neu beginnen
              </Button>
            )}
          </div>
        ) : null}

        <div className="cw-panel" key={step}>
          <header className="cw-head">
            <p className="cw-head__eyebrow">
              Schritt {currentIndex + 1} von {CREATOR_STEPS.length}
            </p>
            <h2 className="cw-head__title">{meta.label}</h2>
            <p className="cw-head__lede">{meta.summary}</p>
          </header>

          <StepComponent {...stepProps} />
        </div>

        <div className="cw-footer">
          {previousStep ? (
            <Button variant="outline" onClick={() => goTo(previousStep)}>
              <NavIcon name="arrow-left" width={16} height={16} />
              {STEP_META[currentIndex - 1].label}
            </Button>
          ) : null}

          <span className="cw-footer__spacer" />

          {currentValidation.issues.length > 0 ? (
            <span className="cw-footer__hint" data-tone="blocked">
              {currentValidation.issues[0]}
            </span>
          ) : null}

          {nextStep ? (
            <Button onClick={() => goTo(nextStep)}>
              {STEP_META[currentIndex + 1].label}
              <NavIcon name="arrow-right" width={16} height={16} />
            </Button>
          ) : null}
        </div>
      </div>

      <CharacterRail
        draft={draft}
        preview={preview}
        species={resolved.species}
        lineage={resolved.lineage}
        dndClass={resolved.dndClass}
        subclass={resolved.subclass}
        background={resolved.background}
      />
    </div>
  );
}

export type { StepProps, ResolvedCatalog };
