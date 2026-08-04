# Essensplan — smarte Woche, geteilter Einkauf, Bon in den Vorrat

Der Wochenplan (`/kitchen/plan`) plant Mahlzeiten je Tag und Slot; daraus
entsteht die konsolidierte Einkaufsliste. Dieses Dokument beschreibt die drei
Schichten darüber: den smarten KI-Wochenvorschlag, den geteilten Wocheneinkauf
und den Weg vom Kassenbon in den Vorrat.

## KI-Wochenvorschlag

Der Button „KI-Vorschlag" fordert über die Connector-Queue (lokale
Maschinenraum-Inferenz, `llm_generate`) einen Wochenentwurf an — nie über einen
Cloud-Provider, und nie automatisch übernommen: der Entwurf liegt auf der Woche
(`MealPlanWeek.aiDraft`), jeder Tag wird einzeln bestätigt.

Der Kontext (`buildKitchenAiContext`, `packages/kitchen/src/ai-suggest.ts`)
enthält seit dem Ausbau:

- **Zutaten je Rezept** (normalisierte Namen) — Grundlage für die Reste-Logik
  („Wraps heute → Wraps-Reste morgen oder übermorgen") und die Anweisung, die
  Zutaten-Überlappung über die Woche zu maximieren, damit wenig eingekauft wird.
  Bei großen Sammlungen bekommen nur die 60 interessantesten Rezepte
  Zutaten-Detail (lange nicht gekocht, dann bestbewertet).
- **Koch-Historie** (`getRecipeHistory`, `cooking-history.ts`): „zuletzt gekocht
  vor N Tagen" aus den Plan-Einträgen der letzten 12 Wochen. Die KI bevorzugt
  lange nicht Gekochtes und wiederholt nichts innerhalb der Woche.
- **Vorrat mit Ablauf**: knappe und bald ablaufende Sachen werden zuerst
  verplant.

**Erfundene Gerichte:** Die KI darf neue Gerichte aus übrigen Zutaten
vorschlagen (`invented: true` + Zutaten-Zeilen). Solche Tage tragen im Entwurf
das Badge „Neu (KI)" und einen zweiten Knopf **„Als Rezept übernehmen"** — der
legt das Gericht als Rezept-**Entwurf** ins Kochbuch (Status `draft`, nach dem
ersten Kochen bestätigen) und plant es am vorgeschlagenen Tag ein.

Modellwahl: der **`chat`-Workflow-Slot** aus dem Command Center (Modelle) —
dieselbe zentrale Stelle wie beim Dokumenten-OCR (`vision`-Slot). Der
Vorschlag-Button verlangt neben dem Family-Häkchen das KI-Flag
(`requireFamilyAiActionAuth`).

## Geteilter Wocheneinkauf: Großeinkauf + Frische-Einkauf

„Einkaufsliste erzeugen" baut weiterhin **eine** Liste pro Woche — aber mit
zwei Abschnitten (`ShoppingListItem.trip`):

- **Großeinkauf** (`main`): alles für den Wochenstart und was sich hält —
  Trockenware, Tiefkühl, Drogerie, plus Verderbliches, das früh in der Woche
  gebraucht wird, und die Grundausstattung.
- **Frische-Einkauf** (`fresh`): Verderbliches (Obst & Gemüse, Kühlregal), das
  erst am Frische-Tag oder später gebraucht wird — Default **Donnerstag**,
  je Woche überschreibbar über `MealPlanGoals.freshWeekday` (0 = Montag).

Die Regel ist deterministisch (`assignShoppingTrip`,
`packages/kitchen/src/shopping-split.ts`): verderbliche Kategorie × erster
Verwendungstag im Plan. Tiefkühl gilt bewusst nicht als verderblich. Positionen
ohne Verwendungstag (manuell, Grundausstattung) landen im Großeinkauf. Die
Einkaufsseite gruppiert Abschnitt → Kategorie; ohne Frische-Positionen entfällt
die Abschnitts-Ebene. Bring!-Sync und Offline-Abhaken arbeiten unverändert auf
der flachen Liste.

## Kassenbon → Vorrat

Der Scan-Eingang fotografiert Belege mit der Rückkamera
(`capture="environment"`) und liest sie über das lokale Dokumenten-OCR
(Unlimited-OCR via `vision_extract`). Für erkannte Kassenbons gilt:

1. `parseReceiptText` (`packages/scan-inbox/src/parse-receipt.ts`) extrahiert
   deterministisch die Positionen (Name, Menge, Preis) und überspringt Summen,
   Pfand, Rabatte und Zahlarten. Findet er nichts Belastbares, bleibt die Liste
   leer und der Scan wird „unsicher" — kein Rate-Müll.
2. Der Ablage-Vorschlag für Bons ist **„In den Vorrat"**. Im Ablage-Formular
   lassen sich Positionen abwählen und Namen korrigieren — erst die
   Bestätigung schreibt `PantryItem`s (Standort pauschal Vorratskammer,
   Feintuning danach in `/kitchen/pantry`). Nie automatisch.

Damit schließt sich der Kreis: Vorrat und Ablaufdaten fließen in den nächsten
KI-Wochenvorschlag ein.

## Family am Handy (PWA)

Family hat ein Web-App-Manifest (`apps/family/app/manifest.ts`) und ist damit
am Handy installierbar; Verknüpfungen führen zu Einkauf, Wochenplan und
Beleg-Scan. Kein Service Worker — offline funktioniert die Einkaufsliste über
`FamilyShoppingOffline` (localStorage + Nachtrag beim Wiederverbinden). Das
Manifest ist von der Middleware ausgenommen, weil der Browser es ohne
Credentials lädt.
