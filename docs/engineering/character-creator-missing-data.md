# Charakter-Ersteller — was an Daten fehlt

> **Umzug:** Der strukturierte Missing-Data-Report (Stand 2026-08-08, alle Lücken
> mit Pflichtfeldern) liegt unter
> **[`docs/character-creator-missing-data.md`](../character-creator-missing-data.md)**.
>
> Import-/Critic-Kurzstatus:
> [`packages/character-creator/dev-progress/IMPLEMENTATION-STATUS.md`](../../packages/character-creator/dev-progress/IMPLEMENTATION-STATUS.md).

Die Abschnitte unten beschreiben den **früheren** Stand (u. a. 4 Hintergründe,
12 Klassen, nur SRD-Neun Spezies) und sind **teilweise überholt**. Für aktuelle
Zähler (23 Spezies, 14 Klassen, 16 Hintergründe, 26 Talente, Zauber L0–L1) und
die Pflichtfeld-Einträge MD-01…MD-15 den kanonischen Report verwenden.

---

# Archiv — frühere Übersicht (2026-08, vor Owner-Import-Runde)

Diese Datei benennt vollständig, welche Daten UWE braucht,
damit der Charakter-Ersteller wirklich benutzbar ist — nicht nur hübsch.

Sie ist nach **Dringlichkeit** sortiert, nicht nach Thema. Wer oben anfängt,
schaltet die meiste Funktion pro Aufwand frei.

Legende:

| Zeichen | Bedeutung |
|---|---|
| ✅ | mit dieser Runde angelegt (`packages/character-creator`), gegen SRD-Volltext geprüft — Umfang und Grenzen siehe § 7 |
| ❌ | fehlt vollständig |

---

## 1. Inhaltskataloge

Vor dieser Runde gab es **keinen einzigen** lokalen Katalog. Die einzige
katalogartige Datenstruktur im ganzen Repo war `SKILL_DEFINITIONS`
(18 Fertigkeiten mit Attributszuordnung) in
`packages/database/src/character-service.ts`, dazu `PICKABLE_CLASSES` —
zwölf deutsche Klassennamen als reine Zeichenketten, ohne jede Metadaten.

Inhalte kamen ausschließlich über HTTP von **Open5e** und **dnd5eapi.co**
(`packages/dnd-api/src/index.ts`). Zwei Einschränkungen machten das für
einen Ersteller unbrauchbar:

1. `searchDnd5eSrd` ist auf `"monsters" | "spells" | "equipment"` typisiert.
   Völker, Klassen, Unterklassen, Hintergründe, Talente, Sprachen und
   Zustände **kann** es gar nicht abrufen, obwohl die API sie ausliefert.
2. Die Suchrouten liegen unter `apps/studio/app/api/dnd/**` und sind mit
   `guardStudioApiRequest` geschützt. Das Portal kommt nicht heran — und
   der Ersteller lebt im Portal.

| Katalog | Status | Anmerkung |
|---|---|---|
| Völker (Spezies) | ✅ 9 Völker, 24 Abstammungen | SRD 5.2.1 kennt **kein** Aasimar — **UPDATE:** inzwischen 23 Spezies inkl. Owner-Extended; siehe kanonischen Report |
| Klassen | ✅ 12 | **UPDATE:** 14 inkl. Erfinder/Blutjäger |
| Unterklassen | ✅ 12 | SRD liefert genau **eine** pro Klasse. Für echte Wahlfreiheit fehlen die restlichen ~40 aus dem PHB — die sind **nicht** CC-BY. |
| Hintergründe | ✅ **nur 4** | **UPDATE:** 16 (4 SRD + 12 Owner-Notizen) |
| Talente | ✅ 19 | **UPDATE:** 26 |
| Ausrüstung (Pakete, Waffen, Rüstung) | ✅ 7 Pakete, 38 Waffen, 13 Rüstungen | |
| Zauber Grad 0–1 | ✅ 27 + 57 | **Grad 2–9 fehlen vollständig** — siehe kanonischen Report MD-01 |
| Sprachen | ✅ 19 | |
| Gesinnungen | ✅ 9 | |
| Zustände (blind, verängstigt …) | ❌ | für den Bogen, nicht für die Erstellung |
| Magische Gegenstände | ❌ | nur remote über Open5e, nicht im Ersteller |
| Werkzeuge & Instrumente als eigene Liste | ❌ | derzeit Freitext in `toolProficiencies` |

---

## 2a. Der Engpass: vier Hintergründe

> **UPDATE:** Zwölf PHB-Hintergründe aus Owner-Notizen sind importiert;
> Eigenbau bleibt Fallback. Details im kanonischen Report / Critic backgrounds.

Das SRD 5.2.1 enthält **vier** Hintergründe. Das Spielerhandbuch 2024 enthält
sechzehn. Die zwölf Differenz-Hintergründe standen damals nur als Lizenz-Lücke
im Raum; Owner-Notizen schließen den mechanischen Engpass für Paladin/Mönch/
Waldläufer inzwischen.

**Gelöst — Weg 1 ist gebaut.** Eigenbau-Hintergrund
(`packages/character-creator/src/rules/custom-background.ts`).

---

## 2–9. Regeldaten, Schema, Assets, Integration, Prüf-Schuld, Lizenz, Eigenbau

Unverändert relevant für Level-up / Sheet — siehe Archiv-Abschnitte in der
Git-Historie dieser Datei bzw. **MD-15** und verwandte Einträge im
[kanonischen Missing-Data-Report](../character-creator-missing-data.md).

Suchbefehl für offene Stellen:

```bash
grep -rn "TODO(unverified)" packages/character-creator/src/
```
