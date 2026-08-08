/** SRD-Zauber Grad 2 — zusammengesetzt. */
import type { Spell } from "../types";
import { LEVEL2_SPELLS_A } from "./spells-level2-a";
import { LEVEL2_SPELLS_B } from "./spells-level2-b";

export const LEVEL2_SPELLS: Spell[] = [...LEVEL2_SPELLS_A, ...LEVEL2_SPELLS_B];
