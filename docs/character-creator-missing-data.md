# Charakter-Ersteller — Missing-Data-Report

Stand: 2026-08-08T16:58:01+02:00

Kanonischer Status: [packages/character-creator/dev-progress/IMPLEMENTATION-STATUS.md](../packages/character-creator/dev-progress/IMPLEMENTATION-STATUS.md).  
Ältere Übersicht: [docs/engineering/character-creator-missing-data.md](engineering/character-creator-missing-data.md).

**Katalog-Ist:** 31 Spezies · 14 Klassen · 16 Hintergründe · 26 Talente · 330 Zauber (0–9) · 38 Erfinder-Inventionen.

---

## Erledigt in dieser Runde (nicht mehr offen)

| ID | Was | Status |
|---|---|---|
| MD-01 | Zauber Grad 2–9 | **Importiert** (246 via Open5e wotc-srd CC-BY; DE-Struktur + Kernwirkung + Material DE). |
| MD-02 | Erfinder-Inventionen | **Importiert** (38; 12 auf Stufe 1 wählbar im ClassStep). |
| MD-MAT | Materialkomponenten DE | **Erledigt** (exakte Map aus Open5e-EN → DE; `scripts/spell-materials-de-map.json`). |
| MD-INV-TEST | Inventionen-Integrität | **Erledigt** (OWNER_NOTES_SOURCE-Guard + L1-Snapshot + Stufenfilter). |
| sizeChoice | Wizard-Persistenz | **Umgesetzt** (sizeKey → resolveSpeciesSize → JSON). |
| Phase-2 Spezies | ifrit…mucosi | **Importiert** (8 + Kathai-Colleges). |
| Erfinder-Zauberliste | L0/L1 | **Erfinder** auf passende Katalogzauber gesetzt (Open5e-SRD ohne Artificer-Liste). |

---

## Noch offen

### MD-A11Y — Portal-a11y E2E hell/dunkel für den Ersteller

| Feld | Inhalt |
|---|---|
| **Entity** | Route /auth/worlds/terra/characters/neu |
| **Fehlt** | Nachweisbarer grüner Lauf von portal-a11y.spec.ts (hell+dunkel, 390/768/1440) gegen laufende Server |
| **Warum nötig** | Abschlussgate UX/a11y; dunkles Thema ist settings-getrieben, nicht prefers-color-scheme |
| **Wo** | e2e/portal-a11y.spec.ts (Einträge vorhanden), applyTheme(page, "hell"\|"dunkel") |
| **Blocking?** | **Non-blocking** für Stufe-1-Funktion; **blocking** für formale a11y-Freigabe |
| **Format** | Playwright-Pass in CI-Log |
| **Quelle** | .cursor/skills / e2e/helpers/shell-audit.ts |
| **Fallback** | Statische Review + Touch-min CSS-Fix; Spec ist verdrahtet |
| **Folge** | Kein CI-Beweis für Kontrast/axe auf der neuen Route |
| **Nächste Aktion** | Auf CI/Linux: Portal-a11y mit grep characters/neu; lokal Windows: .next-Locks vermeiden |

### MD-NPC — Strukturierte NPC-Spezies

| Feld | Inhalt |
|---|---|
| **Entity** | Page.type = npc |
| **Fehlt** | Spezies-Feld an Wiki-NPCs (kein Character.species) |
| **Warum** | Migration/Inventar, wenn NPCs Spezies tragen sollen |
| **Wo** | Studio NPC-Seiten; nicht im Spieler-Ersteller |
| **Blocking?** | Non-blocking (Demo-Seed hat 0 NPCs) |
| **Format** | Entscheidung Owner: Frontmatter vs. Character-Zeile |
| **Quelle** | Owner |
| **Fallback** | Freitext in Seiteninhalt |
| **Folge** | Keine maschinenlesbare NPC-Spezies-Migration nötig/möglich |
| **Nächste Aktion** | Erst bei vorhandenem NPC-Korpus |

---

## Annahme

**ASSUMPTION:** Open5e wotc-srd liefert den klassischen SRD-Zauberbestand (nicht zwingend 1:1 SRD 5.2.1 2024-Wortlaut). Für UWE-Stufe-1 und Katalogtiefe ausreichend; Feinschliff gegen offizielle 5.2.1-PDF bleibt möglich.
