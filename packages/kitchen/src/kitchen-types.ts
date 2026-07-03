/**
 * Client-safe Typen und deutsche Labels für die Küche (`@uwe/kitchen`).
 *
 * Bewusst KEINE Imports aus `@uwe/database` oder dem generierten Prisma-Client:
 * diese Datei ist framework- und server-agnostisch und darf in Client Components
 * genutzt werden. Die String-Unions spiegeln exakt die Prisma-Enums im Schema.
 */

export type RecipeStatus = "draft" | "active" | "archived";

export type IngredientUnit =
  | "gram"
  | "milliliter"
  | "piece"
  | "tbsp"
  | "tsp"
  | "pinch"
  | "bunch"
  | "pack"
  | "freeform";

export type ShoppingCategory =
  | "produce"
  | "chilled"
  | "frozen"
  | "dry"
  | "drugstore"
  | "household"
  | "other";

export const RECIPE_STATUSES: RecipeStatus[] = ["draft", "active", "archived"];

export const INGREDIENT_UNITS: IngredientUnit[] = [
  "gram",
  "milliliter",
  "piece",
  "tbsp",
  "tsp",
  "pinch",
  "bunch",
  "pack",
  "freeform",
];

export const SHOPPING_CATEGORIES: ShoppingCategory[] = [
  "produce",
  "chilled",
  "frozen",
  "dry",
  "drugstore",
  "household",
  "other",
];

export const RECIPE_STATUS_LABELS: Record<RecipeStatus, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  archived: "Archiviert",
};

export const INGREDIENT_UNIT_LABELS: Record<IngredientUnit, string> = {
  gram: "Gramm",
  milliliter: "Milliliter",
  piece: "Stück",
  tbsp: "Esslöffel",
  tsp: "Teelöffel",
  pinch: "Prise",
  bunch: "Bund",
  pack: "Packung",
  freeform: "frei",
};

/** Kurzform der Einheit für die kompakte Mengen-Anzeige (z. B. „2 EL"). */
export const INGREDIENT_UNIT_SHORT_LABELS: Record<IngredientUnit, string> = {
  gram: "g",
  milliliter: "ml",
  piece: "Stück",
  tbsp: "EL",
  tsp: "TL",
  pinch: "Prise",
  bunch: "Bund",
  pack: "Pck.",
  freeform: "",
};

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  produce: "Obst & Gemüse",
  chilled: "Kühlregal",
  frozen: "Tiefkühl",
  dry: "Trockenware",
  drugstore: "Drogerie",
  household: "Haushalt",
  other: "Sonstiges",
};

/** Bewertungsfelder eines Rezepts (1–5), mit deutschem Label. */
export const RECIPE_RATING_FIELDS = [
  { key: "tasteRating", label: "Geschmack" },
  { key: "effortRating", label: "Aufwand" },
  { key: "kidRating", label: "Kind" },
  { key: "partnerRating", label: "Partner" },
] as const;

export type RecipeRatingKey = (typeof RECIPE_RATING_FIELDS)[number]["key"];

/** Eine Rezept-Variante (frei, kein eigenes Modell — als Json gespeichert). */
export interface RecipeVariant {
  title: string;
  description?: string;
}

/** Zutaten-Eingabe aus dem Editor — client-safe. */
export interface RecipeIngredientInput {
  name: string;
  amount?: number | null;
  unit?: IngredientUnit;
  unitLabel?: string | null;
  category?: ShoppingCategory;
  optional?: boolean;
  sortIndex?: number;
}

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type MealEntryType = "recipe" | "leftovers" | "eating_out" | "routine" | "note";

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Frühstück",
  lunch: "Mittag",
  dinner: "Abend",
  snack: "Snack",
};

export const MEAL_ENTRY_TYPES: MealEntryType[] = [
  "recipe",
  "leftovers",
  "eating_out",
  "routine",
  "note",
];

export const MEAL_ENTRY_TYPE_LABELS: Record<MealEntryType, string> = {
  recipe: "Rezept",
  leftovers: "Reste",
  eating_out: "Auswärts",
  routine: "Routine",
  note: "Notiz",
};

/** Wochenziele (frei, als Json gespeichert). */
export interface MealPlanGoals {
  lowEffort?: boolean;
  cheap?: boolean;
  mealPrepCount?: number;
  dinnersOnly?: boolean;
}

/** Rezept-Eingabe aus dem Editor — client-safe. */
export interface RecipeInput {
  title: string;
  status?: RecipeStatus;
  description?: string;
  servingsBase?: number;
  durationMinutes?: number | null;
  effortRating?: number | null;
  tasteRating?: number | null;
  kidRating?: number | null;
  partnerRating?: number | null;
  steps?: string[];
  variants?: RecipeVariant[] | null;
  imageStorageKey?: string | null;
  sourceUrl?: string | null;
  notes?: string;
  ingredients?: RecipeIngredientInput[];
  /** Tag-Keys (werden über EntityTag mit entityType `recipe` verknüpft). */
  tags?: string[];
}
