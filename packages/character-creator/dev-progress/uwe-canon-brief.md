# UWE Canon Brief — Character Creator Lore Rewrite

**Stand:** 2026-08-08  
**Zweck:** Kanonischer Weltkontext, um importierte Charakter-Ersteller-Lore (Tegora / generische FR-Settings) nach UWE umzuschreiben.  
**Regel:** Nur belegte Quellen. Unsicheres als **ASSUMPTION** markiert. Keine erfundene Lore als Kanon ausgeben.

---

## 1. Quellenlage (Priorität)

| Priorität | Quelle | Status |
|---|---|---|
| **P0 — aktiv** | `packages/database/src/terra-seed.ts` + `seedTerraChronicle` (via `prisma/seed.ts`) | Demo-Welt, die der Seed tatsächlich anlegt |
| **P0 — Karteneditor** | `docs/engineering/terra-bearbeitungsplan.md` („Kanon: Arbor und der zerbissene Apfel“), Biom-/Objekt-/Signaturenkataloge, `terra/` Runtime | Setting-Kanon für den Karteneditor Terra |
| **P1 — Namensstil** | `terra/src/generators/namen.js` | Sechs Sprachfamilien, deutsche Ortsnamen-Komposita |
| **P1 — UI-Terminologie** | `packages/character-creator/` | Deutsche Spielerbegriffe (Volk, Klassen, …) |
| **P2 — Legacy** | `packages/database/src/seed.ts` (`SEED_PAGES` / In-Memory-Store) | **Widerspricht** terra-seed bei Arbor/Nepurga — nicht als alleiniger Kanon |
| **Nicht-Kanon** | `tmp/character-creator-source-extract/**` | Importquelle (Kanka „Tegora“, FR-Orte) — umschreiben, nicht übernehmen |

**Konflikt (wichtig):** Es gibt mindestens **drei** Arbor-/Nepurga-Erzählungen. Beim Umschreiben von Charakter-Lore **nicht** stillschweigend mischen. Bis Owner C-01/C-02 löst, gilt der **bindende Rewrite-Default** in §1.1.

---

## 1.1 Rewrite-Default (bindend bis Owner C-01/C-02 löst)

**Priorität für Character-Creator-Spielerflavour:** terra-seed (P0). Terra-Kartenmythos und Legacy-Seed sind **opt-in**, nie Default-Mischung.

| Identität | Default (verbindlich) | Verboten ohne Owner-Entscheidung „Legacy“ |
|---|---|---|
| **Arbor** | **Nördliche Waldregion** (terra-seed): uralter Wald im Norden, Feenheimat, Alias „Der Große Wald“, grenzt im Süden an Validori | Weltbaum / Apfelkern-Arbor; Waldgottheit / Fee-Königin Arbor; Gleichsetzung Region-Arbor = Baum-Arbor |
| **Nepurga** | **Politisches Reich** (terra-seed): Handelskontrolle zwischen Wald und Küste, Grenzposten nahe Arbor | Feenkönigin / „Herrin der Weißen Pocken“; mythologische Nepurga-Person |
| **Terra-Kosmologie** | Nur wenn der Quelltext **explizit** Weltmythos / Kartenkosmos meint (zerrissener Planet, weißer Riesenbaum, Ranken zur Mitte) | Weltbaum-Ton in Charakter-Heimat-, Fraktions- oder Alltagsflavour; Baum-Arbor als Ersatz für Region-Arbor |
| **Legacy `seed.ts`** | Nicht als Spielerflavour-Default | Arbor-Gottheit, Nepurga-Fee, Valendor-Kontinent als verbindliche CC-Lore |

**Regeln für Rewrite-Agenten:**

1. Spieler-sichtbare CC-Texte (Volk, Klasse, Hintergrund, Talent-Flavour) → **immer** terra-seed-Identitäten (Region-Arbor, Reich-Nepurga, Validori, Shagottar nur wenn DM-only — in CC nie).
2. Kosmologischer Ton (Weltbaum, zerrissener Planet) → **nur** wenn der Importtext bereits Kosmos/Weltbaum beschreibt; dann klar als **Karten-/Weltmythos** kennzeichnen, **ohne** Region-Arbor oder Reich-Nepurga umzudeuten.
3. Owner wählt explizit **Legacy** → erst dann Waldgottheit-Arbor / Feenkönigin-Nepurga aus `seed.ts` zulässig; bis dahin verboten.

---

## 2. Weltname(n)

| Name | Rolle | Beleg |
|---|---|---|
| **Terra** | Demo- und Referenzwelt (`slug: terra`) | `terra-seed.ts`, `SEED_WORLDS` |
| **UWE** | Produktname, nicht Weltname | — |
| Aldoria | Nur Beispiel in Shell-Docs (Weltwechsel), **kein** Seed-Inhalt | `docs/engineering/studio-shell.md` |
| Valendor | Nur in Legacy-Beschreibung „Kontinent Valendor“ | `seed.ts` — **ASSUMPTION:** nicht als verbindlicher Kontinentname der Demo behandeln, bis Owner bestätigt |

Weltbeschreibung (aktiv): „Die Hauptwelt von UWE — ein reiches Fantasy-Setting mit alten Mächten, vergessenen Türmen und verborgenen Intrigen.“

Kampagne (Seed): **Schatten über Validori** — politische Intrigen zwischen Nepurga und Validori.

---

## 3. Major places (terra-seed = spielbarer Demo-Kanon)

| Ort | Typ | Kurz |
|---|---|---|
| **Arbor** | Region (`region`) | Uralter Wald im Norden; Heimat der Feen; Alias „Der Große Wald“; grenzt im Süden an Validori |
| **Validori** | Location | Leuchtende Hafenstadt der Magister und Gilden; Küste des **Inneren Meeres**; Alias „Stadt der Magister“; öffentliche Bibliothek (Spielerwissen) |
| **Magister-Turm von Validori** | Location | Höchster Turm / Leuchtturm; Sitz des Erzmagisters; Aliase „Der Leuchtturm“, „Magister-Turm“ |
| **Nepurga** | Faction (Reich) | Aufstrebendes Reich zwischen Wald und Küste; kontrolliert Handelswege Arbor↔Validori |
| **Shagottar** | Location, **DM-only** | Geheime Festung; „wahres Machtzentrum hinter Nepurga“ — nie in Portal-/Spieler-Lore |

Chronik-Kalender: **Kalender von Terra**, Epoche „Zeitalter des Erwachens“, Datum Seed ~ Jahr 472. Monate: Frostmond, Blütenmond, Sonnenmond, Erntemond. Wochentage: Sol, Lun, Mar, Mer, Jov, Ven, Sat.

### Karteneditor-Setting (Terra Art / Biome) — parallel, nicht ersetzen

Aus `terra-bearbeitungsplan.md` u. a.:

> Der Planet **Terra** ist auseinandergerissen. Zusammengehalten wird er vom weißen Riesenbaum **Arbor** — kolossale weiße Ranken sind seine Triebe, spenden Licht. Planet wie zerbissener Apfel; Arbor = Apfelkern. Ranken wachsen **zur Mitte**. Biom-Anker: **Aschebrache** (Bruchkante ins Nichts).

**Weltschildkröte:** Hero-Landmarke / Art-Asset (`weltschildkroete`) — uralt, freundlich, monumental, weise. **Nicht** mit dem Riesenbaum Arbor gleichsetzen; Beziehung Weltbaum ↔ Schildkröte ist in den Seeds **nicht** ausformuliert (**ASSUMPTION:** Landmarke auf/bei Terra, kein Ersatz für Arbor-Kanon).

---

## 4. Peoples / cultures

**Aus Demo-Seed (knapp):**

- **Magister / Gilden** in Validori (Rat der Magister, Erzmagister)
- **Feen** / Feenreiche unter Arbor (Portal unter dem Wald — DM-Notiz)
- **Nepurga-Herrscherhaus** mit Anspruch auf Blutrecht über Feenwälder
- **Nepurga-Spione** vs. Validori-Magier (Artefakt im Magister-Turm)

**Aus Terra-Namensgenerator (Kulturfarbe, kein Wiki-Volk):** Sprachfamilien `doerflich`, `klassisch`, `zwergisch`, `elfisch`, `arbor` (Arbor-Kult), `neutral` — für Ortsnamen und Atmosphäre, nicht als SRD-Spezies-Ersatz.

**ASSUMPTION:** Keine ausgearbeiteten Menschen-/Elfen-/Zwergenreiche jenseits der SRD-Spezies + obiger Fraktionsskizze. Charakter-Flavour darf an Validori/Nepurga/Arbor andocken, ohne neue Reiche zu erfinden.

---

## 5. Religions / cults

| Element | Beleg | Hinweis |
|---|---|---|
| **Arbor-Kult** (Karteneditor) | `namen.js` Familie `arbor`; Pools `arborschrein`, `rankenaltar`, … | Altertümlich, Ranke/Wurzel/Heilig — **Kartengeografie** |
| **Arbor als Waldgottheit** | Nur Legacy `seed.ts` | Widerspricht Region-Arbor in terra-seed |
| **Nepurga als Feenkönigin / „Herrin der Weißen Pocken“** | Nur Legacy `seed.ts` | Widerspricht Reich-Nepurga in terra-seed |
| Druiden von Validori verehren Arbor | Legacy | Nicht in terra-seed |

**Fazit für Rewrite:** Kein fertiges Pantheon. Default: §1.1 — religiöse Flavor-Texte vage halten („Schreine am Waldsaum“, „Magister und Gildenrituale“). Waldgottheit-Arbor / Feenkönigin-Nepurga nur bei expliziter Owner-Entscheidung „Legacy“. SRD-Hintergründe (Akolyth …) bleiben regeltechnisch weltneutral.

---

## 6. Factions / Machtgefüge (terra-seed)

1. **Rat der Magister (Validori)** — berät Handelswege; plant heimlich, Nepurga als Vasallen anzuerkennen (**gegen** Shagottar).
2. **Nepurga (Reich)** — Handelskontrolle; Grenzposten nahe Arbor; nominal unter Shagottar.
3. **Shagottar** — geheime Kontrolle hinter Nepurga; Bürgerkriegsrisiko bei Vasallitäts-Ende (**DM only**).
4. **Feen von Arbor** — Nepurga beansprucht Oberhoheit; Portal zu Feenreichen unter dem Wald (geheim).

Kampagnenton: Intrige, Spionage, Grenzpolitik, verbotene Artefakte — kein High-FR-Abenteuerklischee (Sword Coast).

---

## 7. Naming style

- **Orte:** Deutsche Komposita / lesbar motiviert (Bestimmung + Grundwort), z. B. Muster aus Terra: *Aschenfurt*, *Steinhafen*, Arbor-Kult: *Ur-*, *-hain*, *-geäst*, *-riss* (`namen.js`).
- **Eigennamen der Demo:** Validori, Nepurga, Shagottar, Arbor, Magister-Turm — lateinisch/romanisch bis märchenhaft, nicht „Waterdeep“-Stil.
- **Kalenderwörter:** deutsche Mondnamen + lateinisch angehauchte Wochentage.
- **Kartenlabels:** Natur/Arbor in Antiqua-Richtung; Menschenwerk getrennt (Beschriftungsregeln in Terra UI).

Beim Umschreiben importierter Lore: FR-/Tegora-Ortsnamen ersetzen oder generisch machen („eine Hafenstadt“, „die Handelsgilde“) — wenn konkret, dann Validori/Nepurga/Arbor-Nähe.

---

## 8. Tone rules — deutsche Prosa

1. **Du-Anrede** an den Spieler in Ersteller-Texten (bestehender Katalog-Stil in `packages/character-creator`).
2. Klar, konkret, tischtauglich — was der Spieler *am Tisch* merkt, nicht Setting-Enzyklopädie.
3. Keine Anglizismen in UI-Labels, wo deutsche SRD-/UWE-Begriffe existieren (Volk, Hintergrund, Fertigkeit, …). **Ausnahme (bindend):** Ability-Score-**Anzeigenamen** bleiben **Englisch** — Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma; Keys lowercase English (`strength`, …). Nie Stärke, Geschicklichkeit o. Ä. in umgeschriebenem CC-Flavour.
4. Keine Portal-Leaks: Shagottar, geheime Portale, Rat-Intrigen gegen Spielerwissen nur wenn Text explizit DM-only ist (hier: Charakter-Ersteller = Spielerfläche → **keine** Shagottar-/Geheimplot-Details).
5. Atmosphäre: leuchtende weiße Stein-Türme, Inneres Meer, Feenwald-Norden, Intrigen — optional Kartenton „zerrissener Planet / Ranke“ nur wenn der Text Karten-/Weltmythos meint, nicht als Ersatz für Validori-Politik.
6. **Nicht** inventieren: keine neuen Götter, Königreiche oder Kriege als „Kanon“ ausgeben.

---

## 9. Forbidden setting names (nicht übernehmen)

### Tegora (Importquelle)

„Tegora“ kommt **nicht** im UWE-Produktcode vor. Treffer nur unter `tmp/character-creator-source-extract/` (Kanka `app.kanka.io/w/tegora/...`), u. a.:

| Datei (Extract) | ca. Treffer |
|---|---|
| Spezies__Spezien 1.pdf.txt | 84 |
| Spezies__Spezies 2.pdf.txt | 65 |
| Feats__Feats - Notizen.pdf.txt | 35 |
| Klassen__Artificer … Wizard (viele) | 16–34 je Klasse |
| Background__Background - Notizen.pdf.txt | 18 (+ Fließtext „Tegora combine…“) |

**Aktion:** Jede Erwähnung von Tegora / Kanka-URLs entfernen oder durch Terra-/Validori-neutrale Formulierung ersetzen.

### Fremde Settings / Orte (in Extracts belegt, verboten in UWE-Flavour)

Forgotten Realms / Faerûn-Nähe: **Sword Coast**, **Waterdeep**, **Daggerford**, **Thay**; dazu **Greyhawk**, **Eberron** / **Karrnath**, generische „Alliance“-FR-Formulierungen.

Auch vermeiden: generische FR-Franchise-Floskeln, die den Text sofort als PHB-Abschrift markieren, wenn ein Terra-Bezug gemeint ist.

---

## 10. Preferred UWE terminology (DE UI / Flavour)

| Konzept | Bevorzugt (DE) | Vermeiden / Hinweis |
|---|---|---|
| Species | **Volk** (UI-Schritt); intern „Spezies“ ok | „Rasse“ |
| Lineage | **Abstammung** / elfische Abstammung / Erbe | — |
| Background | **Hintergrund** | — |
| Class | **Klasse** — Barbar, Barde, Kleriker, Druide, Kämpfer, Mönch, Paladin, Waldläufer, Schurke, Hexenmeister, Hexenpakt-Magier, Zauberer | Englische Klassennamen in UI |
| Subclass | **Unterklasse** | — |
| Feat | **Talent** (Ursprungstalent …) | — |
| Dragonborn | **Drachenblütige** | Dragonborn |
| Dwarf / Elf / Gnome / Halfling / Human / Orc / Tiefling / Goliath | **Zwerg, Elf, Gnom, Halbling, Mensch, Ork, Tiefling, Goliath** | Halbork als Spezies (2024: Ork) |
| Ability scores (Keys) | Englische Keys: `strength`, `dexterity`, … | — |
| Ability scores (Anzeige in Flavour-/Mechaniktext) | **Pflicht Englisch:** Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma | Stärke, Geschicklichkeit, … in umgeschriebenem CC-Text — **verboten** |
| Ability scores (UI-Labels im Package) | Soll EN (siehe oben) | **C-05:** bestehende DE-Labels in `ABILITY_LABELS` — separates Produktdefekt-Tracking, **nicht** Lore-Rewrite-Aufweichung |
| Skill / save | Fertigkeit / Rettungswurf | — |

Klassen-Flavour: an UWE-Orte andocken (Hafen Validori, Waldsaum Arbor, Grenzland Nepurga), nicht an Sword Coast.

---

## 11. Rewrite heuristics (kurz)

1. Tegora / Kanka / FR-Orte → streichen oder Terra-neutral.
2. Konkrete Heimatstadt nötig → Validori (küsten/magisch) oder „Dorf am Arbor-Saum“ / Nepurga-Grenzland — ohne neue Kanon-Orte.
3. Religion nötig → „Schrein / Orden / Magister-Gilde“, keine erfundenen Götternamen als Kanon.
4. Antagonist „dunkle Fee“ nur wenn Owner Legacy-Nepurga wählt; sonst politisches Reich Nepurga.
5. DM-only Namen (Shagottar) nie in Spieler-Facing Character Creator Text.
6. Default-Identitäten: §1.1 (Region-Arbor, Reich-Nepurga) — keine Default-Mischung mit Weltbaum- oder Legacy-Mythos.

### Beispiel: Tegora/FR → Terra-Default (vorher / nachher)

**Vorher (Import, Nicht-Kanon):**  
„Du stammst aus einem Dorf an der Sword Coast, nahe Waterdeep. Die Gilde schickt dich nach Tegora — dein **Strength**-Bonus hilft dir im Hafen.“

**Nachher (Rewrite-Default, terra-seed):**  
„Du stammst aus einem Dorf am **Arbor-Saum**, südlich der nördlichen Waldregion. Handelswege führen dich Richtung **Validori** am Inneren Meer — dein **Strength**-Bonus hilft dir an den Kaien.“

*(Nepurga erscheint hier nicht als Fee, sondern nur wenn der Text Fraktions-/Grenzpolitik braucht: „… oder du kennst die Grenzposten des Reichs **Nepurga**.“ Kosmologie/Weltbaum nur, wenn der Quelltext explizit Weltmythos meint — sonst weglassen.)*

---

## 12. Open defects / blocked for canon workstream

| ID | Thema | Status |
|---|---|---|
| C-01 | Arbor = Waldregion vs. Weltbaum vs. Waldgottheit | **blocked** — Owner-Entscheidung |
| C-02 | Nepurga = Reich vs. Feenkönigin | **blocked** — Owner-Entscheidung |
| C-03 | Valendor als Kontinent | **ASSUMPTION** / unklar |
| C-04 | Weltschildkröte ↔ Arbor-Mythos | nicht kanonisch verknüpft |
| C-05 | Ability-Labels EN in UI-Package vs. DE in `ABILITY_LABELS` | Produktdefekt (UI) — Lore-Rewrite nutzt EN unabhängig davon |

---

## 13. Source index (zum Nachlesen)

- `packages/database/src/terra-seed.ts`
- `packages/database/src/seed.ts` (Legacy, konfliktär)
- `packages/database/prisma/seed.ts`
- `docs/engineering/terra-bearbeitungsplan.md` (§ Kanon)
- `docs/engineering/terra-biomkatalog.md`, `terra-objektkatalog.md`, `terra-signaturenkatalog.md`
- `terra/src/generators/namen.js`
- `terra/art-direction/briefs/weltschildkroete.json`
- `packages/character-creator/src/content/species.ts`, `classes-*.ts`, `rules/steps.ts`, `rules/abilities.ts`
- `tmp/character-creator-source-extract/` (nur als Negativliste / Tegora-Hits)

