import type { FamilyPrismaClient } from "@uwe/database/family-client";
import { FAMILY_MODEL_NAMES } from "@uwe/product-contracts";

/**
 * Export der geteilten Family-Daten (`uwe-family.db`) — das Gegenstück zu
 * `brain-export.ts` für den dritten Speicher.
 *
 * Family-Daten sind bewusst nicht owner-privat: wer das Häkchen `Family` hat,
 * sieht alles darin. Der Export ist trotzdem getrennt, weil die Datei getrennt
 * ist — ein Restore darf Family-Zeilen nicht in die Brain-DB schreiben.
 *
 * Wie beim Brain-Export ist die Schlüsselmenge zur Compile-Zeit an
 * FAMILY_MODEL_NAMES gebunden (expliziter Record) und wird im Test
 * gegengeprüft: ein neues Family-Modell kann dem Export nicht entwischen.
 */
export const FAMILY_EXPORT_MODEL_KEYS = [
  "ContractExpense", "CalendarFeed", "CalendarEvent", "DocumentTemplate",
  "Recipe", "RecipeIngredient", "MealPlanWeek", "MealPlanEntry",
  "ShoppingList", "ShoppingListItem", "BringConnection",
  "ScanDocument", "MaintenanceTask", "PantryItem",
  "FamilyChatConversation", "FamilyChatMessage", "FamilyBrainFact", "FamilyMemberProfile",
  "CalendarEventMember", "FamilyHealthRecord", "FamilyHealthRecordMember",
  "FamilyCalendarSubscription", "FamilyCalendarSubscriptionMember",
  "FamilyCalDavAccount",
] as const;

export type FamilyExportModelKey = (typeof FAMILY_EXPORT_MODEL_KEYS)[number];

type FamilyModelReaders = Record<FamilyExportModelKey, () => Promise<unknown[]>>;

function familyModelReaders(db: FamilyPrismaClient): FamilyModelReaders {
  return {
    ContractExpense: () => db.contractExpense.findMany(),
    CalendarFeed: () => db.calendarFeed.findMany(),
    CalendarEvent: () => db.calendarEvent.findMany(),
    DocumentTemplate: () => db.documentTemplate.findMany(),
    Recipe: () => db.recipe.findMany(),
    RecipeIngredient: () => db.recipeIngredient.findMany(),
    MealPlanWeek: () => db.mealPlanWeek.findMany(),
    MealPlanEntry: () => db.mealPlanEntry.findMany(),
    ShoppingList: () => db.shoppingList.findMany(),
    ShoppingListItem: () => db.shoppingListItem.findMany(),
    BringConnection: () => db.bringConnection.findMany(),
    ScanDocument: () => db.scanDocument.findMany(),
    MaintenanceTask: () => db.maintenanceTask.findMany(),
    PantryItem: () => db.pantryItem.findMany(),
    FamilyChatConversation: () => db.familyChatConversation.findMany(),
    FamilyChatMessage: () => db.familyChatMessage.findMany(),
    FamilyBrainFact: () => db.familyBrainFact.findMany(),
    FamilyMemberProfile: () => db.familyMemberProfile.findMany(),
    CalendarEventMember: () => db.calendarEventMember.findMany(),
    FamilyHealthRecord: () => db.familyHealthRecord.findMany(),
    FamilyHealthRecordMember: () => db.familyHealthRecordMember.findMany(),
    // Enthält nur Hashes, keine Klartext-Tokens — ein Restore stellt die Abos
    // wieder her, ohne dass ein Geheimnis im Backup liegt.
    FamilyCalendarSubscription: () => db.familyCalendarSubscription.findMany(),
    // Ohne die Zuordnung würde ein auf Personen eingeschränktes Abo nach dem
    // Restore für den ganzen Haushalt gelten.
    FamilyCalendarSubscriptionMember: () => db.familyCalendarSubscriptionMember.findMany(),
    FamilyCalDavAccount: () => db.familyCalDavAccount.findMany(),
  };
}

export interface FamilyExportBundle {
  formatVersion: 1;
  exportedAt: string;
  models: Record<FamilyExportModelKey, unknown[]>;
  counts: Record<FamilyExportModelKey, number>;
}

/** Liest jedes Family-Modell in ein portables Bündel. Read-only auf der Quelle. */
export async function collectFamilyExport(db: FamilyPrismaClient): Promise<FamilyExportBundle> {
  const readers = familyModelReaders(db);
  const models = {} as Record<FamilyExportModelKey, unknown[]>;
  const counts = {} as Record<FamilyExportModelKey, number>;
  for (const key of FAMILY_EXPORT_MODEL_KEYS) {
    const rows = await readers[key]();
    models[key] = rows;
    counts[key] = rows.length;
  }
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    models,
    counts,
  };
}

/** True, wenn der Export exakt die Family-Modellmenge des Kontrakts abdeckt. */
export function familyExportCoversContract(): boolean {
  const exported = [...FAMILY_EXPORT_MODEL_KEYS].sort();
  const contract = [...FAMILY_MODEL_NAMES].map(String).sort();
  return exported.length === contract.length && exported.every((name, i) => name === contract[i]);
}
