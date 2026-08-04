/**
 * `@uwe/kitchen` — Küche / Essensplaner-Fundament.
 *
 * Namens-Hinweis: bewusst nicht „cookbook" (kollidiert mit `@uwe/cookbook` =
 * LLM-Modell-Auswahl) und nicht „meal-planner" (Kitchen deckt Rezepte, Plan,
 * Einkauf und Vorrat ab). K1: Rezept-CRUD + Zutaten. K2: Wochenplan +
 * konsolidierte Einkaufsliste.
 *
 * Neue Symbole werden über diesen Root exportiert, nie über
 * `@uwe/database/server`.
 */
export * from "./kitchen-types";
export * from "./units";
export * from "./ingredient-merge";
export * from "./shopping-split";
export * from "./recipe-service";
export * from "./meal-plan-service";
export * from "./shopping-service";
export * from "./pantry-service";
export * from "./cooking-history";
export * from "./ai-suggest";
export * from "./bring-client";
export * from "./bring-service";
export * from "./recipe-card-layout";
export * from "./ai-recipe-format";
