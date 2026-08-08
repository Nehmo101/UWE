/** SRD-Zauber Grad 4 — zusammengesetzt. */
import type { Spell } from "../types";
import { LEVEL4_SPELLS_A } from "./spells-level4-a";
import { LEVEL4_SPELLS_B } from "./spells-level4-b";

export const LEVEL4_SPELLS: Spell[] = [...LEVEL4_SPELLS_A, ...LEVEL4_SPELLS_B];
