/** SRD-Zauber Grad 6 — zusammengesetzt. */
import type { Spell } from "../types";
import { LEVEL6_SPELLS_A } from "./spells-level6-a";
import { LEVEL6_SPELLS_B } from "./spells-level6-b";

export const LEVEL6_SPELLS: Spell[] = [...LEVEL6_SPELLS_A, ...LEVEL6_SPELLS_B];
