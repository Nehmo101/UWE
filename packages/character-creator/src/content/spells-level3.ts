/** SRD-Zauber Grad 3 — zusammengesetzt. */
import type { Spell } from "../types";
import { LEVEL3_SPELLS_A } from "./spells-level3-a";
import { LEVEL3_SPELLS_B } from "./spells-level3-b";

export const LEVEL3_SPELLS: Spell[] = [...LEVEL3_SPELLS_A, ...LEVEL3_SPELLS_B];
