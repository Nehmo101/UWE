/**
 * `@uwe/kitchen` — Küche / Essensplaner-Fundament.
 *
 * Namens-Hinweis: bewusst nicht „cookbook" (kollidiert mit `@uwe/cookbook` =
 * LLM-Modell-Auswahl) und nicht „meal-planner" (Kitchen deckt später Rezepte,
 * Plan, Einkauf und Vorrat ab). Phase K1 liefert Rezept-CRUD + Zutaten.
 *
 * Neue Symbole werden über diesen Root exportiert, nie über
 * `@uwe/database/server`.
 */
export * from "./kitchen-types";
export * from "./units";
export * from "./recipe-service";
