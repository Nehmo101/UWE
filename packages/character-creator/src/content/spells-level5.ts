/** SRD-Zauber Grad 5 — zusammengesetzt. */
import type { Spell } from "../types";
import { LEVEL5_SPELLS_A } from "./spells-level5-a";
import { LEVEL5_SPELLS_B } from "./spells-level5-b";

export const LEVEL5_SPELLS: Spell[] = [...LEVEL5_SPELLS_A, ...LEVEL5_SPELLS_B];
