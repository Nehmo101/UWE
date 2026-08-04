/**
 * Pure Split-Logik für den Wocheneinkauf: ein großer Einkauf am Wochenstart,
 * ein kleiner Frische-Einkauf später in der Woche (Default Donnerstag).
 *
 * Regel: In den Frische-Einkauf wandert nur, was verderblich ist (Obst & Gemüse,
 * Kühlregal — Tiefkühl bewusst nicht) UND erst am Frische-Tag oder danach
 * gebraucht wird. Alles andere — inklusive Grundausstattung und Positionen ohne
 * Verwendungstag — gehört in den Großeinkauf. Framework-agnostisch, keine
 * DB-Imports.
 */
import type { ShoppingCategory, ShoppingTrip } from "./kitchen-types";

/** Kategorien, die nicht bis zum Wochenende durchhalten. */
export const PERISHABLE_CATEGORIES: readonly ShoppingCategory[] = ["produce", "chilled"];

/** Wochentag des Frische-Einkaufs (0 = Montag … 6 = Sonntag): Donnerstag. */
export const DEFAULT_FRESH_WEEKDAY = 3;

export interface TripAssignInput {
  category: ShoppingCategory;
  firstUseDate: Date | null;
}

/**
 * Index eines Datums innerhalb der Wochentage (0 = Montag … 6 = Sonntag),
 * Vergleich auf UTC-Tagesebene. `null`, wenn das Datum nicht in der Woche liegt.
 */
export function weekdayIndexOf(date: Date, weekDates: readonly Date[]): number | null {
  const key = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  for (let index = 0; index < weekDates.length; index += 1) {
    const day = weekDates[index];
    if (Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) === key) {
      return index;
    }
  }
  return null;
}

/**
 * Ordnet eine konsolidierte Position dem Einkaufs-Abschnitt zu. `freshWeekday`
 * außerhalb von 1–6 (oder undefiniert) fällt auf Donnerstag zurück — Montag als
 * Frische-Tag hieße „alles Großeinkauf" und bleibt darum ausgeschlossen.
 */
export function assignShoppingTrip(
  item: TripAssignInput,
  weekDates: readonly Date[],
  freshWeekday: number = DEFAULT_FRESH_WEEKDAY,
): ShoppingTrip {
  const fresh =
    Number.isInteger(freshWeekday) && freshWeekday >= 1 && freshWeekday <= 6
      ? freshWeekday
      : DEFAULT_FRESH_WEEKDAY;

  if (!item.firstUseDate) return "main";
  if (!PERISHABLE_CATEGORIES.includes(item.category)) return "main";

  const useIndex = weekdayIndexOf(item.firstUseDate, weekDates);
  if (useIndex === null) return "main";
  return useIndex >= fresh ? "fresh" : "main";
}
