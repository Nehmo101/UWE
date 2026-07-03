# Detailplan: Essensplaner / Küche (`@uwe/kitchen`)

Stand: 2026-07-03 · Teil von [feature-roadmap-2026-07.md](feature-roadmap-2026-07.md) (Welle 1–3, Phasen K1–K4).

**Ziel:** UWE kennt die eigenen Rezepte, plant daraus Wochen, erzeugt konsolidierte
Einkaufslisten, kennt Vorräte — und merkt sich, was funktioniert hat (Kind mochte es,
Aufwand, Saison). Kein Kalorien-/Diät-Tool, kein Banking: ein privates Koch-Brain.

> **Umsetzungsstand 2026-07-03:** Phase K1 gebaut. Package `@uwe/kitchen`
> (`Recipe`/`RecipeIngredient`-Modelle + Migration, `units.ts` pure Normalisierung/
> Formatierung, `recipe-service.ts` mit transaktionaler Zutaten-Ersetzung + Tag-
> Integration, 26 Tests) + Studio-Routen `/kitchen`, `/kitchen/recipes`,
> `/kitchen/recipes/[id]` + Nav-Eintrag „Küche". **Offen:** Bild-Upload im Editor
> (TODO); **K2 gebaut** (Wochenplan `/kitchen/plan` + konsolidierte Einkaufsliste
> `/kitchen/shopping`, pure Merge-Logik `ingredient-merge.ts`, ISO-Wochen, 26 Tests).
> **K3 gebaut** (`pantry-service.ts` Vorratskammer + „Koche mit…", `ai-suggest.ts`
> RTX-lokale Wochenvorschläge mit graceful degradation, Seite `/kitchen/pantry`,
> Rezept-Bild-Upload; 57 Tests gesamt).
> **KI-Vorschlag-UI-Trigger gebaut:** `MealPlanWeek.aiDraft`-Spalte (Migration
> dual), `MealPlanService.setAiDraft`, „KI-Wochenvorschlag"-Button auf
> `/kitchen/plan` → `suggestWeek` (Connector-Queue) → persistierter Draft →
> Owner übernimmt Tage einzeln (`applyDraftEntryAction`, mit Rezept-ID-Validierung
> gegen Halluzination) oder verwirft; RTX-offline/Parse-Fehler als Query-Banner.
> Reiner Wochentag→Datum-Resolver `resolveDraftDate` (getestet); 61 Tests gesamt.
> **Offen:** K4 (volle Rezept-Extraktion aus Scans — das Scan→Recipe-Draft-Ziel
> existiert bereits), Rezept-Bild-Serving-Route.

---

## 1. Package & Naming

**`packages/kitchen` (`@uwe/kitchen`)** — bewusst nicht „cookbook" (Namenskollision mit
`packages/cookbook` = LLM-Modell-Auswahl; im Package-README erklären) und nicht
„meal-planner" (Kitchen deckt Rezepte + Plan + Einkauf + Vorrat ab). Studio-Routen
unter `/kitchen`. Services via `createKitchenService(db)`-Familie mit injiziertem
PrismaClient; pure Utils framework-agnostisch. Neue Symbole nur über den Package-Root,
nie über `@uwe/database/server`.

## 2. Prisma-Modelle (pragmatisches Set K1–K3, + Postgres-Mirror)

```prisma
enum RecipeStatus { draft | active | archived }        // draft = Scanner-Brücke
enum MealSlot { breakfast | lunch | dinner | snack }
enum MealEntryType { recipe | leftovers | eating_out | routine | note }
enum ShoppingCategory { produce | chilled | frozen | dry | drugstore | household | other }
enum PantryLocation { pantry | fridge | freezer | spices }
enum IngredientUnit { gram | milliliter | piece | tbsp | tsp | pinch | bunch | pack | freeform }

model Recipe {
  id, title, status RecipeStatus @default(active)
  description String @default("")
  servingsBase Float @default(2)          // skaliert zur Planzeit auf householdFactor
  durationMinutes Int?
  effortRating / tasteRating / kidRating / partnerRating Int?   // 1–5
  steps Json                               // string[]
  variants Json?                           // [{title, description, ingredientOverrides?}]
                                           // → eigenes Modell erst, wenn es weh tut
  imageStorageKey String?
  sourceUrl String?  sourceScanId String?  // Scanner-Brücke (K4)
  notes String @default("")  metadata Json?
  ingredients RecipeIngredient[]
  @@index([status]) @@map("recipes")
}

model RecipeIngredient {
  id, recipeId FK cascade
  name String
  normalizedName String                    // Merge-Key (lowercase, singularisiert)
  amount Float?  unit IngredientUnit @default(freeform)  unitLabel String?
  category ShoppingCategory @default(other)
  optional Boolean @default(false)  sortIndex Int @default(0)
  @@index([recipeId]) @@index([normalizedName]) @@map("recipe_ingredients")
}

model MealPlanWeek {
  id, isoYear Int, isoWeek Int  @@unique([isoYear, isoWeek])
  householdFactor Float @default(2.5)      // 2,5 Personen / Familie
  goals Json?          // { lowEffort?, cheap?, mealPrepCount?, dinnersOnly? }
  aiDraft Json?        // letzter KI-Wochenvorschlag, wartet auf Bestätigung
  notes String @default("")
  entries MealPlanEntry[]
  @@map("meal_plan_weeks")
}

model MealPlanEntry {
  id, weekId FK cascade, date DateTime, slot MealSlot
  entryType MealEntryType @default(recipe)
  recipeId String? (SetNull), servings Float?, note String @default("")
  cooked Boolean @default(false), sortIndex Int @default(0)
  @@index([weekId, date]) @@map("meal_plan_entries")
}

model ShoppingList {
  id, weekId String? (SetNull), title, done Boolean @default(false), createdAt
  items ShoppingListItem[]  @@map("shopping_lists")
}
model ShoppingListItem {
  id, listId FK cascade, name, normalizedName
  amount Float?, unit IngredientUnit @default(freeform), unitLabel String?
  category ShoppingCategory @default(other)
  checked Boolean @default(false)
  recurring Boolean @default(false)        // Grundausstattung (Hafermilch, Nudeln, …)
  sourceRecipeIds Json?, sortIndex Int
  @@index([listId, category]) @@map("shopping_list_items")
}

model PantryItem {
  id, name, normalizedName, location PantryLocation @default(pantry)
  amount Float?, unit IngredientUnit @default(freeform), unitLabel String?
  expiresAt DateTime?, lowStock Boolean @default(false), notes String @default("")
  @@index([location]) @@index([expiresAt]) @@map("pantry_items")
}
```

- **Tags**: `Tag`/`EntityTag` wiederverwenden — `recipe` zu `EntityTagEntityType`
  ergänzen. Vegan / kindgerecht / schnell / Meal Prep / günstig / saisonal sind normale
  Tags; Filterung über bestehende Tag-Queries.
- **Feste Routinen** („Freitag Pizza", „Sonntag Brot"): kein Extra-Modell —
  `MealEntryType.routine` + „Woche aus Vorlage/Vorwoche erstellen" in K2.

## 3. Package-Layout (`packages/kitchen/src/`)

- `kitchen-types.ts` — geteilte Typen/Labels, client-safe.
- `units.ts` — **pure**: Einheiten-Normalisierung (kg→g, l→ml), keine Umrechnung
  zwischen Einheiten-Arten, Formatierung (800 g, 1,2 kg).
- `ingredient-merge.ts` — **pure, test-schwere Kernlogik**: Konsolidierung nach
  `normalizedName` + Einheiten-Art (2× 400 g → 800 g; inkompatible Einheiten bleiben
  getrennte Zeilen), Skalierung `servings/servingsBase × householdFactor`,
  Vorrats-Abzug (inkl. Teilmengen), Grundausstattungs-Injektion, Kategorie-Gruppierung.
- `recipe-service.ts`, `meal-plan-service.ts` (ISO-Wochen-Helper lokal —
  `packages/calendar` ist CalDAV/iCal-fokussiert und wird hier bewusst nicht
  missbraucht), `shopping-service.ts` (Liste aus Woche: mergen → Vorrat abziehen →
  kategorisieren), `pantry-service.ts` (Bestand, Ablauf-Warnungen, „Koche mit X, Y, Z"
  = Rezept-Ranking über `normalizedName`-Matches als pure Util + Query).

## 4. KI-Assistenz (`ai-suggest.ts`, Phase K3)

- Baut kompakten Kitchen-Kontext (Rezept-Index mit Tags/Ratings, Vorrats-Snapshot,
  Wochenziele) und ruft die **Connector-Queue direkt** (`createConnectorService(db)` +
  `waitForConnectorJob`, Job-Typ `llm_generate` — exakt das Muster aus
  `packages/ai-brain/src/router/providers/connectorQueueProvider.ts`).
- Output = validierter JSON-Draft (Wochenplan / Substitutionen / kindgerechte
  Anpassung / Skalierung) → gespeichert in `MealPlanWeek.aiDraft` → Owner bestätigt
  pro Tag → Apply schreibt `MealPlanEntry`s. **Nie Auto-Apply.**
- **Entscheidung: kein neuer `AiContextMode`, kein `routeAiRequest`.** Kitchen-Daten
  sind privat → müssen RTX-lokal bleiben wie `personal_brain`; ein neuer Kontextmodus
  hieße Eingriffe in `privacyGuard.ts`, `contextBuilder.ts`, Gateway-Policy und
  UI-Modus-Picker — großer Diff ohne Nutzen, da die Connector-Queue per Konstruktion
  local-only ist. Falls später ein Chat-artiges „Kitchen Brain" gewünscht ist:
  `kitchen` zu den LOCAL_ONLY-Kontextmodi hinzufügen.
- Kein `llm_local`-Connector online → Feature degradiert sauber
  („RTX offline — KI-Vorschläge nicht verfügbar"), alles Manuelle funktioniert weiter.

## 5. Studio-UI

- `apps/studio/app/kitchen/page.tsx` — Dashboard (diese Woche, ablaufende Vorräte).
- `kitchen/recipes/page.tsx` + `kitchen/recipes/[id]/page.tsx` — Sammlung + Editor
  (Zutaten-Editor, Ratings, Varianten, Bild via bestehendes `@uwe/assets`-Upload-Muster).
- `kitchen/plan/page.tsx` — Wochengrid (Slots, „nur Abendessen"-Toggle, Reste-Tage,
  Routinen), „Woche aus Vorlage erstellen".
- `kitchen/shopping/page.tsx` — Checkbox-Liste nach Kategorie, mobile-tauglich
  (fürs Einkaufen am Handy).
- `kitchen/pantry/page.tsx` — Vorrat nach Ort, Ablaufdaten, „Koche mit …".
- `apps/studio/app/kitchen-actions.ts` — dünne Server Actions.
- Nav-Sektion „Küche" in `apps/studio/src/navigation/studio-nav.ts`
  (+ `navigation.test.ts`).

## 6. Phasen & Verifikation

| Phase | Inhalt | Shipbar wenn |
|-------|--------|--------------|
| K1 | Schema (Recipe/RecipeIngredient + `recipe`-Tag-Enum), Rezept-CRUD, Zutaten-Editor, Ratings, Bild, Tags, `/kitchen/recipes` | Rezepte anlegbar und per Tag filterbar |
| K2 | MealPlanWeek/Entry + Wochengrid + Routinen/Reste + Einkaufslisten-Generierung (`units.ts`/`ingredient-merge.ts` mit voller Test-Suite) + Grundausstattung | Woche → konsolidierte, kategorisierte Liste mit Checkboxen |
| K3 | PantryItem + Vorrats-Abzug + Ablauf-Ansicht + „Koche mit X, Y, Z" + KI-Vorschläge (RTX-lokal, Draft→Bestätigen) | vegane Woche lokal generiert, nach Review übernommen |
| K4 (= Scan S3) | Scanner-Brücke: `ScanDocumentKind.recipe`-Ablage → `Recipe(status: draft, sourceScanId)` | gescanntes Rezept wird Draft |

Verifikation: `ingredient-merge.test.ts` (2× 400 g → 800 g, g+kg-Mix, Stück ≠ Gramm,
Skalierung 2 → 2,5 Personen, Teilmengen-Abzug, Basics-Dedupe), `units.test.ts`
(Round-Trips), Service-Tests mit isoliertem Prisma (`@uwe/database/test-helpers`):
Week-Uniqueness (`isoYear`/`isoWeek`), Listen-Generierung end-to-end, Ablauf-Query;
`ai-suggest`-JSON-Parsing mit kaputten LLM-Outputs (sauberer Fehler, nie Partial-Apply).
Gate: `pnpm quality`; manuell: echte Woche planen und mit der Liste am Handy einkaufen.
