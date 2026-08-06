/**
 * Die Schrittfolge und ihre Prüfung.
 *
 * Zwei Regeln bestimmen den Ablauf:
 *
 *   1. **Kein Schritt sperrt einen anderen.** Wer erst die Attribute
 *      verteilen und dann die Spezies wählen will, darf das. Gesperrt ist
 *      nur das Speichern am Ende — dafür müssen alle Pflichtschritte stehen.
 *   2. **Ein Schritt kann entfallen.** Ein Kämpfer wählt keine Zauber. Der
 *      Schritt verschwindet dann nicht aus der Leiste, sondern wird als
 *      „nicht nötig" markiert — sonst springt die Nummerierung und der
 *      Spieler glaubt, etwas verpasst zu haben.
 */

import type {
  Background,
  CharacterDraft,
  Feat,
  CreatorStepKey,
  DndClass,
  Species,
  StepMeta,
  StepValidation,
} from "../types";
import { isBackgroundBonusValid } from "./derive";
import { checkCustomBackground, CUSTOM_BACKGROUND_KEY } from "./custom-background";

export const STEP_META: StepMeta[] = [
  {
    key: "species",
    label: "Volk",
    summary: "Woher dein Charakter stammt — und was ihm das mitgibt.",
    icon: "users",
  },
  {
    key: "class",
    label: "Klasse",
    summary: "Was dein Charakter kann, wenn es darauf ankommt.",
    icon: "swords",
  },
  {
    key: "background",
    label: "Hintergrund",
    summary: "Was er vor dem Abenteuer gemacht hat — und wo seine Werte herkommen.",
    icon: "scroll-text",
  },
  {
    key: "abilities",
    label: "Attribute",
    summary: "Sechs Zahlen, die alles andere tragen.",
    icon: "dices",
  },
  {
    key: "skills",
    label: "Fertigkeiten",
    summary: "Worin er geübt ist.",
    icon: "target",
  },
  {
    key: "equipment",
    label: "Ausrüstung",
    summary: "Womit er loszieht.",
    icon: "backpack",
  },
  {
    key: "spells",
    label: "Zauber",
    summary: "Was er wirken kann.",
    icon: "sparkles",
  },
  {
    key: "details",
    label: "Beschreibung",
    summary: "Name, Aussehen, Geschichte.",
    icon: "feather",
  },
  {
    key: "review",
    label: "Übersicht",
    summary: "Alles auf einen Blick, dann anlegen.",
    icon: "check-check",
  },
];

export function stepMeta(step: CreatorStepKey): StepMeta {
  const found = STEP_META.find((meta) => meta.key === step);
  if (!found) throw new Error(`Unbekannter Schritt: ${step}`);
  return found;
}

/** Kontext, den die Prüfung braucht — der aufgelöste Katalog zum Entwurf. */
export interface ValidationContext {
  draft: CharacterDraft;
  species: Species | null;
  dndClass: DndClass | null;
  /** Bereits aufgelöst — Katalog oder Eigenbau, siehe `resolveBackground`. */
  background: Background | null;
  /**
   * Die wählbaren Ursprungstalente. Wird hereingereicht, damit die Regeln den
   * Katalog nicht importieren müssen; leer lassen heißt „keins ist gültig".
   */
  originFeats: readonly Feat[];
}

/** Wählt diese Klasse auf Stufe 1 überhaupt Zauber? */
export function needsSpellStep(dndClass: DndClass | null): boolean {
  if (!dndClass?.spellcasting) return false;
  const { cantripsKnown, spellsKnownAtFirst } = dndClass.spellcasting;
  return cantripsKnown > 0 || spellsKnownAtFirst > 0;
}

function validateSpecies(ctx: ValidationContext): StepValidation {
  const issues: string[] = [];
  if (!ctx.species) {
    issues.push("Wähle ein Volk.");
  } else if (ctx.species.lineages?.length && !ctx.draft.lineageKey) {
    issues.push(`Wähle eine ${ctx.species.lineageLabel ?? "Abstammung"}.`);
  }
  return { step: "species", complete: issues.length === 0, issues, skipped: false };
}

function validateClass(ctx: ValidationContext): StepValidation {
  const issues: string[] = [];
  if (!ctx.dndClass) {
    issues.push("Wähle eine Klasse.");
  } else if (ctx.dndClass.subclassLevel <= 1 && !ctx.draft.subclassKey) {
    issues.push(`Wähle ${ctx.dndClass.subclassLabel}.`);
  }
  return { step: "class", complete: issues.length === 0, issues, skipped: false };
}

function validateBackground(ctx: ValidationContext): StepValidation {
  const issues: string[] = [];

  if (ctx.draft.backgroundKey === CUSTOM_BACKGROUND_KEY) {
    // Beim Eigenbau sagt der Bauplan, was noch fehlt — „Wähle einen
    // Hintergrund" wäre hier nutzlos, der Spieler hat ja schon gewählt.
    issues.push(...checkCustomBackground(ctx.draft.customBackground, ctx.originFeats).issues);
  } else if (!ctx.background) {
    issues.push("Wähle einen Hintergrund.");
  }

  return { step: "background", complete: issues.length === 0, issues, skipped: false };
}

function validateAbilities(ctx: ValidationContext): StepValidation {
  const issues: string[] = [];
  const allocation = ctx.draft.abilities;

  if (!allocation) {
    issues.push("Verteile deine Attributswerte.");
    return { step: "abilities", complete: false, issues, skipped: false };
  }

  if (allocation.method === "standard_array" || allocation.method === "roll") {
    const pool =
      allocation.method === "roll"
        ? (allocation.rolled ?? [])
        : [15, 14, 13, 12, 10, 8];
    // Bei „roll" muss erst gewürfelt worden sein.
    if (allocation.method === "roll" && pool.length !== 6) {
      issues.push("Würfle deine sechs Werte.");
    }
  }

  if (!ctx.background) {
    issues.push("Der Hintergrund bestimmt deine Attributsboni — wähle ihn zuerst.");
  } else if (!isBackgroundBonusValid(ctx.background, allocation.backgroundBonus)) {
    issues.push("Verteile die Boni deines Hintergrunds (+2/+1 oder +1/+1/+1).");
  }

  return { step: "abilities", complete: issues.length === 0, issues, skipped: false };
}

function validateSkills(ctx: ValidationContext): StepValidation {
  const issues: string[] = [];
  if (!ctx.dndClass) {
    issues.push("Die Klasse bestimmt, wie viele Fertigkeiten du wählst.");
    return { step: "skills", complete: false, issues, skipped: false };
  }

  const want = ctx.dndClass.skills.choose;
  const have = ctx.draft.chosenSkills.length;
  if (have < want) {
    const missing = want - have;
    issues.push(
      missing === 1 ? "Wähle noch eine Fertigkeit." : `Wähle noch ${missing} Fertigkeiten.`,
    );
  } else if (have > want) {
    issues.push(`Du hast ${have - want} Fertigkeiten zu viel gewählt.`);
  }

  return { step: "skills", complete: issues.length === 0, issues, skipped: false };
}

function validateEquipment(ctx: ValidationContext): StepValidation {
  const issues: string[] = [];
  if (!ctx.dndClass) {
    issues.push("Die Klasse bestimmt deine Startausrüstung.");
  } else if (!ctx.draft.equipmentChoice) {
    issues.push("Wähle deine Startausrüstung.");
  }
  return { step: "equipment", complete: issues.length === 0, issues, skipped: false };
}

function validateSpells(ctx: ValidationContext): StepValidation {
  if (!needsSpellStep(ctx.dndClass)) {
    return {
      step: "spells",
      complete: true,
      issues: [],
      skipped: true,
    };
  }

  const spellcasting = ctx.dndClass?.spellcasting;
  const issues: string[] = [];
  const wantCantrips = spellcasting?.cantripsKnown ?? 0;
  const wantSpells = spellcasting?.spellsKnownAtFirst ?? 0;

  if (ctx.draft.cantrips.length !== wantCantrips) {
    issues.push(`Wähle ${wantCantrips} Zaubertricks (aktuell ${ctx.draft.cantrips.length}).`);
  }
  if (ctx.draft.spells.length !== wantSpells) {
    issues.push(`Wähle ${wantSpells} Zauber des 1. Grades (aktuell ${ctx.draft.spells.length}).`);
  }

  return { step: "spells", complete: issues.length === 0, issues, skipped: false };
}

function validateDetails(ctx: ValidationContext): StepValidation {
  const issues: string[] = [];
  if (!ctx.draft.name.trim()) {
    issues.push("Dein Charakter braucht einen Namen.");
  }
  return { step: "details", complete: issues.length === 0, issues, skipped: false };
}

const VALIDATORS: Record<
  Exclude<CreatorStepKey, "review">,
  (ctx: ValidationContext) => StepValidation
> = {
  species: validateSpecies,
  class: validateClass,
  background: validateBackground,
  abilities: validateAbilities,
  skills: validateSkills,
  equipment: validateEquipment,
  spells: validateSpells,
  details: validateDetails,
};

/** Prüft alle Schritte. Die Übersicht ist fertig, wenn alle anderen es sind. */
export function validateDraft(ctx: ValidationContext): StepValidation[] {
  const results = (Object.keys(VALIDATORS) as Array<keyof typeof VALIDATORS>).map((step) =>
    VALIDATORS[step](ctx),
  );

  const outstanding = results.filter((result) => !result.complete && !result.skipped);
  results.push({
    step: "review",
    complete: outstanding.length === 0,
    issues: outstanding.length === 0 ? [] : ["Es fehlen noch Entscheidungen."],
    skipped: false,
  });

  // In der Reihenfolge der Schrittleiste zurückgeben, nicht in Objektreihenfolge.
  const order = STEP_META.map((meta) => meta.key);
  return results.sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step));
}

export function isDraftComplete(ctx: ValidationContext): boolean {
  return validateDraft(ctx).every((result) => result.complete || result.skipped);
}

/** Der nächste Schritt, der noch etwas braucht — für „Weiter zum Fehlenden". */
export function firstIncompleteStep(ctx: ValidationContext): CreatorStepKey | null {
  const found = validateDraft(ctx).find(
    (result) => !result.complete && !result.skipped && result.step !== "review",
  );
  return found?.step ?? null;
}
