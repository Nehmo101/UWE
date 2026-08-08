/**
 * Der Datenvertrag des Charakter-Erstellers.
 *
 * Alles hier ist reine Beschreibung — keine Prisma-Typen, kein React, kein
 * Netzwerk. Der Katalog (`src/content/*`) füllt diese Formen mit SRD-Inhalt,
 * die Regeln (`src/rules/*`) rechnen damit, und erst das Portal bindet beides
 * an die Datenbank. Deshalb ist dieses Paket framework-agnostisch und
 * vollständig testbar.
 *
 * Herkunft der Inhalte: SRD 5.2.1 (CC-BY-4.0, Wizards of the Coast). Jeder
 * Katalogeintrag trägt seine Quelle in `source`, damit die Attribution nicht
 * an einer Stelle im Code hängt, die jemand später wegräumt.
 */

import type { CustomBackgroundDraft } from "./rules/custom-background";

/** Die sechs Attribute — Schlüssel identisch zu `AbilityScores` in @uwe/database. */
export const ABILITIES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

export type AbilityKey = (typeof ABILITIES)[number];

export type AbilityScoreMap = Record<AbilityKey, number>;

/**
 * Die 18 Fertigkeiten. Bewusst identisch zu `SkillKey` aus
 * `@uwe/database` — dort ist die Wahrheit für den Bogen, hier für die
 * Erstellung. Ein Test hält beide Listen deckungsgleich
 * (`skill-parity.test.ts`), damit sie nicht auseinanderlaufen.
 */
export const SKILLS = [
  "acrobatics",
  "animal_handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight_of_hand",
  "stealth",
  "survival",
] as const;

export type SkillKey = (typeof SKILLS)[number];

/** Woher ein Eintrag stammt. Trägt die Lizenz-Attribution mit. */
export interface ContentSource {
  /** z. B. "SRD 5.2.1" */
  book: string;
  /** z. B. "CC-BY-4.0" */
  license: string;
}

export const SRD_SOURCE: ContentSource = {
  book: "SRD 5.2.1",
  license: "CC-BY-4.0",
};

/** Owner-Notizen-Import (PHB-Hintergrund-Ursprungstalente außerhalb des SRD). */
export const OWNER_NOTES_SOURCE: ContentSource = {
  book: "Owner-Notizen (UWE-Import)",
  license: "Installationseigen — nicht SRD",
};

/** Gemeinsamer Kopf jedes Katalogeintrags. */
export interface CatalogEntry {
  /** Stabiler technischer Schlüssel, kleingeschrieben, ASCII (z. B. "hochelf"). */
  key: string;
  /** Deutscher Anzeigename. */
  name: string;
  /** Englischer Originalname — für SRD-Abgleich und Spell-/Item-Suche. */
  nameEn: string;
  /**
   * Ein Satz, der die Entscheidung trägt. Nicht der Regeltext — das ist der
   * Satz, den ein neuer Spieler liest, um zu wissen, ob ihn das interessiert.
   */
  hook: string;
  /** Der ausführliche Beschreibungstext (mehrere Absätze erlaubt). */
  description: string;
  source: ContentSource;
}

// ───────────────────────────── Spezies ─────────────────────────────

export type CreatureSize = "tiny" | "small" | "medium" | "large";

/** Ein Merkmal, das eine Spezies, Klasse oder ein Hintergrund mitbringt. */
export interface Trait {
  name: string;
  description: string;
  /** Ab welcher Stufe greift es? Für Spezies/Hintergrund immer 1. */
  level?: number;
}

export interface Species extends CatalogEntry {
  size: CreatureSize;
  /** Manche Spezies dürfen zwischen zwei Größen wählen (z. B. Goliath: nein, Zwerg: nein). */
  sizeChoice?: CreatureSize[];
  /** Bewegungsrate in Fuß. */
  speed: number;
  darkvision: number | null;
  traits: Trait[];
  /** Untervölker/Abstammungen, falls die Spezies eine Wahl verlangt. */
  lineages?: SpeciesLineage[];
  /** Was die Wahl der Abstammung überschreibt, als Klartext für die UI. */
  lineageLabel?: string;
  /**
   * Bildmarke. Verweist auf eine Datei unter `/character-creator/species/`
   * im jeweiligen `public`-Verzeichnis — extern geladene Bilder verbietet
   * die CSP.
   */
  art?: string;
}

export interface SpeciesLineage extends CatalogEntry {
  traits: Trait[];
  /** Überschreibt die Größe des Eltern-Volks, wenn die Abstammung abweicht (z. B. Goblin = Small). */
  size?: CreatureSize;
  darkvision?: number | null;
  speed?: number;
}

// ───────────────────────────── Klassen ─────────────────────────────

export type SpellcastingProgression = "full" | "half" | "third" | "pact" | "none";

export interface ClassSpellcasting {
  progression: SpellcastingProgression;
  ability: AbilityKey;
  /** Bereitet die Klasse Zauber vor oder kennt sie sie fest? */
  preparation: "prepared" | "known";
  /** Zaubertricks auf Stufe 1. */
  cantripsKnown: number;
  /** Zauber des 1. Grades, die auf Stufe 1 gewählt werden. */
  spellsKnownAtFirst: number;
  /** Auf welche Zauberliste greift die Klasse zu (Schlüssel der Liste). */
  spellList: string;
}

export interface ClassSkillChoice {
  /** Wie viele Fertigkeiten die Klasse auf Stufe 1 vergibt. */
  choose: number;
  /** Aus welchen. Leer = alle 18. */
  from: SkillKey[];
}

export interface DndClass extends CatalogEntry {
  hitDie: 6 | 8 | 10 | 12;
  primaryAbilities: AbilityKey[];
  savingThrows: AbilityKey[];
  skills: ClassSkillChoice;
  /** Rüstungen/Waffen/Werkzeuge als Klartext-Zeilen für die Übersicht. */
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  spellcasting: ClassSpellcasting | null;
  /** Merkmale der Stufe 1 (mehr braucht der Ersteller nicht). */
  features: Trait[];
  /** Auf welcher Stufe die Unterklasse gewählt wird (SRD 2024: meist 3). */
  subclassLevel: number;
  subclassLabel: string;
  subclasses: Subclass[];
  /** Startausrüstungs-Optionen (A/B) plus Gold-Alternative. */
  startingEquipment: EquipmentOption[];
  startingGoldAlternative: number | null;
  /**
   * Wofür die Klasse am Tisch gut ist — drei bis fünf Schlagworte für die
   * Vergleichsansicht ("Nahkampf", "Heilung", "Kontrolle").
   */
  roleTags: string[];
  /** 1 = einfach zu spielen, 3 = anspruchsvoll. Steuert den Anfänger-Hinweis. */
  complexity: 1 | 2 | 3;
  art?: string;
}

export interface Subclass extends CatalogEntry {
  features: Trait[];
}

/** Erfinder-Invention (Infusion) — Owner-Notizen, Stufe-1-Ersteller wählt eine mit prerequisiteLevel 1. */
export interface Invention extends CatalogEntry {
  /** Mindest-Erfinderstufe zum Erlernen (1 = ab Stufe 1 wählbar). */
  prerequisiteLevel: number;
  /** Objekttypen aus den Notizen (z. B. „Rüstung oder Schild“). */
  itemType: string;
  requiresAttunement?: boolean;
}

// ─────────────────────────── Hintergründe ───────────────────────────

export interface Background extends CatalogEntry {
  /**
   * SRD 2024: Der Hintergrund vergibt +2/+1 oder +1/+1/+1 auf drei fest
   * zugeordnete Attribute. Der Spieler verteilt innerhalb dieser drei.
   */
  abilityOptions: AbilityKey[];
  skills: SkillKey[];
  toolProficiency: string | null;
  /** Ursprungstalent — Schlüssel in den Feats. */
  originFeat: string;
  equipment: string[];
  startingGold: number;
  art?: string;
}

// ───────────────────────────── Talente ─────────────────────────────

export type FeatCategory = "origin" | "general" | "fighting_style" | "epic_boon";

export interface Feat extends CatalogEntry {
  category: FeatCategory;
  /** Voraussetzung als Klartext, null wenn keine. */
  prerequisite: string | null;
  benefits: Trait[];
  /** Manche Talente geben zusätzlich einen Attributspunkt zur Wahl. */
  abilityIncrease?: { choose: 1; from: AbilityKey[]; amount: 1 } | null;
}

// ─────────────────────────── Ausrüstung ───────────────────────────

export interface EquipmentLine {
  name: string;
  quantity: number;
  /** Gewicht in Pfund, falls bekannt. */
  weight?: number | null;
  /** Wert in Kupfermünzen — eine Einheit für alles, die UI formatiert. */
  valueCp?: number | null;
  notes?: string;
}

/** Eine wählbare Startausrüstungs-Variante („Option A"). */
export interface EquipmentOption {
  key: string;
  label: string;
  items: EquipmentLine[];
  /** Zusätzliches Startgold in Goldmünzen. */
  gold: number;
}

export interface EquipmentPack extends CatalogEntry {
  items: EquipmentLine[];
  costGp: number;
}

// ───────────────────────────── Zauber ─────────────────────────────

export type MagicSchool =
  | "abjuration"
  | "conjuration"
  | "divination"
  | "enchantment"
  | "evocation"
  | "illusion"
  | "necromancy"
  | "transmutation";

export interface Spell extends CatalogEntry {
  level: number;
  school: MagicSchool;
  castingTime: string;
  range: string;
  components: { verbal: boolean; somatic: boolean; material: string | null };
  duration: string;
  concentration: boolean;
  ritual: boolean;
  /** Auf welchen Klassenlisten der Zauber steht (Klassenschlüssel). */
  lists: string[];
}

// ───────────────────── Sprachen, Gesinnung, Sonstiges ─────────────────────

export interface Language extends CatalogEntry {
  /** Standardsprache oder seltene Sprache. */
  rarity: "standard" | "rare";
  script: string | null;
}

export interface Alignment {
  key: string;
  name: string;
  nameEn: string;
  /** Kurzcharakterisierung für die Auswahl. */
  hook: string;
}

// ──────────────────────── Der Erstellungs-Zustand ────────────────────────

/** Wie die Attribute erzeugt wurden. */
export type AbilityMethod = "standard_array" | "point_buy" | "roll" | "manual";

export interface AbilityAllocation {
  method: AbilityMethod;
  /** Die Grundwerte vor Hintergrund-Bonus. */
  base: AbilityScoreMap;
  /** Was der Hintergrund draufgelegt hat. */
  backgroundBonus: Partial<Record<AbilityKey, number>>;
  /** Bei „roll": die gewürfelten Werte in Wurfreihenfolge. */
  rolled?: number[];
}

/**
 * Der vollständige Entwurf. Jeder Schritt füllt ein Feld; `null` heißt
 * „noch nicht entschieden". Genau dieses Objekt wird zwischengespeichert,
 * damit ein halb gebauter Charakter einen Reload überlebt.
 */
export interface CharacterDraft {
  name: string;
  speciesKey: string | null;
  lineageKey: string | null;
  /** Gewählte Größe, wenn das Volk sizeChoice anbietet (z. B. Mensch, Tiefling). */
  sizeKey: CreatureSize | null;
  classKey: string | null;
  subclassKey: string | null;
  /** Erste Invention auf Stufe 1, wenn Klasse erfinder. */
  inventionKey: string | null;
  backgroundKey: string | null;
  /**
   * Der selbst gebaute Hintergrund, falls `backgroundKey` auf den Eigenbau
   * zeigt. Das SRD liefert nur vier Hintergründe, und weil seit 2024 die
   * Attributsverteilung daran hängt, findet die Hälfte der Klassen darunter
   * keinen passenden. Der Bauplan für eigene Hintergründe steht selbst im
   * SRD — siehe `rules/custom-background.ts`.
   */
  customBackground: CustomBackgroundDraft | null;
  abilities: AbilityAllocation | null;
  /** Fertigkeiten, die der Spieler über die Klasse gewählt hat. */
  chosenSkills: SkillKey[];
  /** Gewählte Startausrüstungs-Option, oder "gold" für die Goldvariante. */
  equipmentChoice: string | null;
  /** Zaubertricks und Zauber der Stufe 1 (Zauberschlüssel). */
  cantrips: string[];
  spells: string[];
  languages: string[];
  alignmentKey: string | null;
  /** Freitextfelder des Beschreibungsschritts. */
  details: CharacterDetails;
}

export interface CharacterDetails {
  pronouns: string;
  age: string;
  height: string;
  weight: string;
  eyes: string;
  hair: string;
  skin: string;
  appearance: string;
  backstory: string;
  personality: string;
  ideals: string;
  bonds: string;
  flaws: string;
}

export const EMPTY_DETAILS: CharacterDetails = {
  pronouns: "",
  age: "",
  height: "",
  weight: "",
  eyes: "",
  hair: "",
  skin: "",
  appearance: "",
  backstory: "",
  personality: "",
  ideals: "",
  bonds: "",
  flaws: "",
};

export function emptyDraft(): CharacterDraft {
  return {
    name: "",
    speciesKey: null,
    lineageKey: null,
    sizeKey: null,
    classKey: null,
    subclassKey: null,
    inventionKey: null,
    backgroundKey: null,
    customBackground: null,
    abilities: null,
    chosenSkills: [],
    equipmentChoice: null,
    cantrips: [],
    spells: [],
    languages: [],
    alignmentKey: null,
    details: { ...EMPTY_DETAILS },
  };
}

// ─────────────────────────── Schritte & Prüfung ───────────────────────────

export const CREATOR_STEPS = [
  "species",
  "class",
  "background",
  "abilities",
  "skills",
  "equipment",
  "spells",
  "details",
  "review",
] as const;

export type CreatorStepKey = (typeof CREATOR_STEPS)[number];

export interface StepMeta {
  key: CreatorStepKey;
  /** Deutscher Titel in der Schrittleiste. */
  label: string;
  /** Ein Satz unter dem Titel. */
  summary: string;
  icon: string;
}

/** Was ein Schritt noch braucht, bevor er als fertig gilt. */
export interface StepValidation {
  step: CreatorStepKey;
  complete: boolean;
  /** Anwendbare Hinweise in der Reihenfolge, in der sie erledigt werden. */
  issues: string[];
  /** Der Schritt ist für diesen Charakter gar nicht nötig (z. B. Zauber beim Kämpfer). */
  skipped: boolean;
}
