import type { AbilityKey } from "@uwe/character-creator";

/**
 * English ability score names for the attributes step — product rule (C-05).
 * Validation copy and hints stay German; only the score names use English.
 */
export const ABILITY_DISPLAY_NAMES: Record<AbilityKey, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  constitution: "Constitution",
  intelligence: "Intelligence",
  wisdom: "Wisdom",
  charisma: "Charisma",
};

/** Three-letter abbreviations (STR … CHA) for compact cells in the same step. */
export const ABILITY_DISPLAY_SHORT: Record<AbilityKey, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};
