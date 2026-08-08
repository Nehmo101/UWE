# Charakter-Ersteller — Missing-Data-Report

Stand: 2026-08-08T17:50:00+02:00

Kanonischer Status: [packages/character-creator/dev-progress/IMPLEMENTATION-STATUS.md](../packages/character-creator/dev-progress/IMPLEMENTATION-STATUS.md).  
Ältere Übersicht: [docs/engineering/character-creator-missing-data.md](engineering/character-creator-missing-data.md).

**Katalog-Ist:** 31 Spezies · 14 Klassen · 16 Hintergründe · 26 Talente · 330 Zauber (0–9) · 38 Erfinder-Inventionen.

---

## Erledigt

| ID | Was | Status |
|---|---|---|
| MD-01 | Zauber Grad 2–9 | **Importiert** (Open5e wotc-srd CC-BY; DE + Material DE). |
| MD-02 | Erfinder-Inventionen | **Importiert** (38; 12 auf Stufe 1 im ClassStep). |
| MD-MAT | Materialkomponenten DE | **Erledigt** (`scripts/spell-materials-de-map.json`). |
| MD-INV-TEST | Inventionen-Integrität | **Erledigt** (OWNER_NOTES + L1-Snapshot). |
| sizeChoice | Wizard-Persistenz | **Umgesetzt** (`sizeKey` → JSON). |
| Phase-2 Spezies | ifrit…mucosi | **Importiert**. |
| Erfinder-Zauberliste | L0/L1 | **Erfinder** auf Katalogzauber gesetzt. |
| MD-A11Y | Portal-a11y Spec | **Verdrahtet** in `e2e/portal-a11y.spec.ts` + statische Review; Lauf über CI/`test:e2e:a11y`. |
| Progress-Page | Studio-Admin | **`progress.json` Schema** an die UI angeglichen; Rebuild-Skript vorhanden. |

---

## Bewusst zurückgestellt

### MD-NPC — Strukturierte NPC-Spezies

Nicht Teil des Spieler-Erstellers. Demo-Seed hat **0** NPC-Seiten und **0** `Character.species`-Zeilen. Entscheidung Owner erst bei realem NPC-Korpus (Frontmatter vs. Character-Zeile).

---

## Annahme

**ASSUMPTION:** Open5e wotc-srd liefert den klassischen SRD-Zauberbestand (nicht zwingend 1:1 SRD 5.2.1 2024-Wortlaut). Für UWE-Stufe-1 ausreichend.
