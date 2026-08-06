# Charakter-Ersteller — was an Daten fehlt

Stand: 2026-08. Diese Datei benennt vollständig, welche Daten UWE braucht,
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
| Völker (Spezies) | ✅ 9 Völker, 24 Abstammungen | SRD 5.2.1 kennt **kein** Aasimar |
| Klassen | ✅ 12 | mit Trefferwürfel, Rettungswürfen, Fertigkeitswahl, Zauberprogression |
| Unterklassen | ✅ 12 | SRD liefert genau **eine** pro Klasse. Für echte Wahlfreiheit fehlen die restlichen ~40 aus dem PHB — die sind **nicht** CC-BY. |
| Hintergründe | ✅ **nur 4** | Akolyth, Krimineller, Weiser, Soldat — mehr hat das SRD nicht. Siehe § 2a. |
| Talente | ✅ 19 | 6 Ursprungs-, 2 allgemeine, 4 Kampfstile, 7 Epische Gaben — das ist der vollständige SRD-Satz |
| Ausrüstung (Pakete, Waffen, Rüstung) | ✅ 7 Pakete, 38 Waffen, 13 Rüstungen | |
| Zauber Grad 0–1 | ✅ 27 + 57 | **Grad 2–9 fehlen vollständig** — siehe § 3 |
| Sprachen | ✅ 19 | |
| Gesinnungen | ✅ 9 | |
| Zustände (blind, verängstigt …) | ❌ | für den Bogen, nicht für die Erstellung |
| Magische Gegenstände | ❌ | nur remote über Open5e, nicht im Ersteller |
| Werkzeuge & Instrumente als eigene Liste | ❌ | derzeit Freitext in `toolProficiencies` |

---

## 2a. Der Engpass: vier Hintergründe

Das SRD 5.2.1 enthält **vier** Hintergründe. Das Spielerhandbuch 2024 enthält
sechzehn. Die zwölf Differenz-Hintergründe (Handwerker, Scharlatan,
Unterhalter, Bauer, Wache, Kundschafter, Einsiedler, Kaufmann, Adliger,
Matrose, Schreiber, Wanderer) stehen **nicht** unter CC-BY und dürfen nicht
abgeschrieben werden.

Das ist die schwerwiegendste inhaltliche Lücke des Erstellers, denn seit
2024 hängt am Hintergrund **die Attributsverteilung und das
Ursprungstalent**. Vier Hintergründe heißen: vier legale Wege, Attribute zu
verteilen. Ein Spieler, der einen Waldläufer mit hoher Weisheit bauen will,
findet dafür keinen passenden Hintergrund.

Drei Auswege, in der Reihenfolge, in der ich sie empfehlen würde:

1. **Eigenbau-Hintergründe** (§ 9). Die 2024er Regeln erlauben es
   ausdrücklich, Hintergründe nach Bauplan selbst zu erstellen: drei
   Attribute, zwei Fertigkeiten, ein Werkzeug, ein Ursprungstalent,
   Ausrüstung. Dieser Bauplan **ist** im SRD und darf umgesetzt werden.
   Damit wird aus der Lücke ein Werkzeug.
2. **Welt-eigene Hintergründe** durch den Spielleiter im Studio pflegen.
3. Nur mit gekaufter Lizenz: die PHB-Hintergründe nachtragen.

### Konkret: fünf von zwölf Klassen sind nicht sinnvoll baubar

Die vier SRD-Hintergründe bieten genau diese Attributs-Tripel an:

| Hintergrund | Attribute |
|---|---|
| Akolyth | INT · WEI · CHA |
| Krimineller | GES · KON · INT |
| Weiser | KON · INT · WEI |
| Soldat | STÄ · GES · KON |

Damit gibt es **keinen** Hintergrund, der die Primärattribute dieser Klassen
zugleich anhebt:

| Klasse | braucht | im Angebot |
|---|---|---|
| Paladin | STÄ + CHA | — |
| Mönch | GES + WEI | — |
| Waldläufer | GES + WEI | — |
| Barde | CHA + GES | — |
| Hexenpakt-Magier | CHA + KON | — |

Diese Spieler müssen ihren wichtigsten Wert ungeboostet lassen. Das ist keine
Geschmacksfrage, sondern ein mechanischer Nachteil, den der Ersteller heute
weder verhindert noch erklärt. **Das ist die dringlichste Einzelbaustelle
des Erstellers.**

Solange keiner der drei Auswege gebaut ist, sollte der Ersteller die
Beschränkung im Hintergrund- **und** im Klassen-Schritt benennen statt sie zu
verschweigen — mindestens ein Satz an der Klassenkachel, wenn kein
Hintergrund zu ihren Primärattributen passt.

Dieselbe Klemme in kleiner: **eine Unterklasse pro Klasse**. Das SRD liefert
genau eine, das PHB rund vier. Wer im Ersteller „Pfad des Berserkers" als
einzige Barbaren-Option sieht, hält das für einen Fehler — dort gehört ein
Satz hin, der erklärt, warum.

---

## 2. Regeldaten, die auch nach dieser Runde fehlen

Der Ersteller baut einen Charakter der **Stufe 1**. Alles Folgende braucht
er dafür nicht — der Charakterbogen und der Stufenaufstieg brauchen es sehr wohl,
und ohne diese Daten ist der Charakter nach der ersten Sitzung tot im Wasser.

| Fehlt | Wofür | Wo es hingehört |
|---|---|---|
| **Klassen-Merkmalstabelle Stufe 2–20** | Stufenaufstieg zeigt heute nur TP und Übungsbonus | `packages/character-creator/src/content/class-progression.ts` |
| **ASI-/Talent-Stufen** (4, 8, 12, 16, 19 + Klassenausnahmen) | `character-level-up-service` kennt Attributsverbesserungen **gar nicht** | dito |
| **Unterklassen-Wahlstufe pro Klasse** | teilweise da (`subclassLevel`), Merkmale ab Stufe 6/10/14 fehlen | dito |
| **Zauberplätze für Halb-/Pakt-Zauberer** | `FULL_CASTER_SLOT_TABLE` deckt nur volle Zauberer ab; Paladin/Waldläufer/Hexenpakt-Magier werden falsch gerechnet | `packages/database/src/character-spell-service.ts` |
| **Rüstungswerte strukturiert** | RK wird heute **nicht** berechnet, sondern von Hand eingetragen | `EquipmentLine` braucht `armor: {baseAc, dexCap, addsDex, stealthDisadvantage, strengthRequirement}` |
| **Waffenwerte strukturiert** | Angriffsbonus und Schaden werden nirgends abgeleitet | `EquipmentLine` braucht `weapon: {damage, damageType, properties[], range, mastery}` |
| **Trefferwürfel-Vorrat** | Kurze Rast ist ohne ihn nicht abbildbar | `CharacterCombat` |
| **Tragkraft / Belastung** | `weight` existiert auf `InventoryItem`, wird nirgends summiert | abgeleitet |
| **Währung am Charakter** | Charaktere haben **keinen eigenen Geldbeutel** — Geld gibt es nur am Gruppenschatz | neues Feld auf `Character` oder `bio` |
| **Waffenmeisterschaften (2024)** | zentrale Neuerung der Fassung, fehlt komplett | Katalog |
| **Vorbereitete vs. bekannte Zauber pro Stufe** | nur Stufe-1-Zahlen vorhanden | Klassentabelle |

---

## 3. Zauber — die größte einzelne Lücke

Der Katalog dieser Runde enthält **Grad 0 und 1**. Das reicht für die
Erstellung und für nichts danach.

- **Grad 2–9 fehlen** (~320 Zauber im SRD).
- Die `CharacterSpell`-Tabelle speichert Zauber als **denormalisierte Kopie**
  mit nur Name, Grad, Schule und Beschreibung. **Nicht gespeichert:**
  Komponenten, Zeitaufwand, Reichweite, Wirkungsdauer, Konzentration,
  Ritual, Klassenliste. Ein Zauber aus der Datenbank kann daher im Bogen
  gar nicht vollständig dargestellt werden — egal wie gut der Ersteller ist.
- Konsequenz: `CharacterSpell` braucht diese Felder, **oder** die Zauber
  müssen als Verweis in den lokalen Katalog zeigen statt als Kopie.

Das ist die Empfehlung: `CharacterSpell.spellKey` auf den Katalogschlüssel
zeigen lassen und die Kopie nur noch für Selbstgebautes benutzen.

---

## 4. Schema — Felder, die es gibt, aber niemand füllt

Vier JSON-Spalten auf `Character` waren bis zu dieser Runde **write-only**:
`CharacterService.create()` schrieb sie als `Prisma.InputJsonValue` durch,
und **nichts im ganzen Repo** hat sie je gelesen, geparst oder getippt.

| Spalte | Vorher | Jetzt |
|---|---|---|
| `species` | ungenutzt | Form definiert, vom Ersteller gefüllt |
| `background` | ungenutzt | dito |
| `features` | ungenutzt | dito |
| `bio` | ungenutzt | dito |

**Noch offen:**

- `PortalCharacterView` gibt Volk, Hintergrund, Merkmale und Biografie
  **nicht** heraus — der Bogen im Portal kann sie also weiterhin nicht
  anzeigen, obwohl sie jetzt in der Datenbank stehen.
- `CharacterService.update()` kann diese vier Spalten **nicht** ändern.
  Wer seinen Hintergrund korrigieren will, kann es nicht.
- `UpdateCharacterInput` kennt weder `campaignId` noch `rulesEdition` noch
  `pageId`.
- `DndRulesEdition` wird gespeichert, **verzweigt aber nirgends Logik**.
  Alle Formeln sind fest auf 2024 verdrahtet. Ein Charakter mit
  `dnd5e_2014` wird heute schlicht falsch gerechnet.
- Kein `avatar`/`portrait`-Feld auf `Character`.

---

## 5. Fehlende Assets

| Fehlt | Wofür |
|---|---|
| Volks-Wappen (9 + 24 Abstammungen) | `/character-creator/species/<key>.svg` — der Katalog verweist bereits darauf |
| Klassen-Embleme (12) | `/character-creator/classes/<key>.svg` |
| Hintergrund-Vignetten | Kachelbild im Hintergrund-Schritt |
| Zauberschul-Symbole (8) | Filterleiste im Zauber-Schritt |
| Charakter-Porträts / Avatar-Upload | D&D Beyond stellt das Porträt in die Kopfzeile; UWE hat dafür kein Feld und keinen Upload-Pfad |
| Würfel-Textur / 3D-Würfel | der Wurf ist derzeit CSS-Bewegung, keine Physik |

Bis Dateien existieren, zeichnet der Ersteller ein aus dem Schlüssel
abgeleitetes Sigill. Das ist ein Platzhalter, kein Ziel.

---

## 6. Integrationslücken

- **Kein Charakter-Inventar-Weg.** Es gibt **keine** Server Action, die einem
  Charakter direkt einen Gegenstand hinzufügt. Die einzigen Pfade führen
  über den Gruppenschatz (`packages/database/src/party-treasury-service.ts`
  → `addItem`, dann zuweisen). Startausrüstung muss diesen Weg mitbenutzen.
- **Kampagnenzuweisung bleibt beim Spielleiter** (Kampagnen-Cockpit). Das ist
  Absicht, sollte im Ersteller aber erklärt werden.
- **Kein Import** aus D&D Beyond, Roll20 oder einer `.json`-Charakterdatei.
- **Kein Export** außer dem bestehenden Bogen-Druck
  (`character-sheet-export.ts`, `format: html|markdown`).
- **Mehrklassencharaktere sind nicht möglich.** `bumpClasses` hebt bei
  unbekannter Klasse still die **erste** Klasse an, statt eine zweite
  anzulegen. Der Ersteller legt bewusst nur eine Klasse an.
- **Keine Zufalls-/Schnellerstellung** („würfle mir einen Charakter").

---

## 7. Prüf-Schuld — bitte ernst nehmen

Der direkte Abgleich mit dem SRD-PDF war **nicht** möglich: Die
Egress-Richtlinie dieser Umgebung lehnt ausgehende HTTPS-Verbindungen zu
allen Hosts mit `403` ab (`connect_rejected` — `media.dndbeyond.com` ebenso
wie `example.com`).

Stattdessen wurde gegen **Volltext-Übertragungen des SRD 5.2.1** geprüft, die
im Container verfügbar waren (`oldmanumby/dnd.srd.5.2.1`,
`downfallx/dnd-5e-srd-markdown`, `your5e/5e-srd-markdown` mit der
unveränderten PDF-Konversion, sowie die deutsche Übertragung
`netzrenner/dnd.srd.5.2.1-de`). Das ist keine Primärquelle, aber deutlich
mehr als Modellwissen.

| Katalog | Geprüft gegen | Belastbarkeit |
|---|---|---|
| Völker, Abstammungen | Volltext + deutsche Übertragung | hoch |
| Klassen, Unterklassen | Volltext, Merkmalstexte zeilenweise | hoch |
| Hintergründe | PDF-Textextraktion + 2 Konversionen | hoch — der Fund „nur vier" stammt daher |
| Talente | dieselben Quellen | hoch |
| Ausrüstung, Waffen, Rüstung | SRD-Tabellen zeilenweise | hoch |
| Zauber (84) | **zwei unabhängige** Übertragungen, Feld für Feld verglichen; `lists` maschinell extrahiert und zurückgeprüft (84/84, null Abweichungen) | hoch |

**Was trotzdem offen bleibt:**

- Keine dieser Quellen ist das amtliche PDF. Ein Abgleich gegen
  `SRD_CC_v5.2.1.pdf` bleibt die saubere Abnahme.
- Die **deutschen Namen sind Übersetzungen dieses Projekts**, keine Zitate —
  eine offizielle deutsche SRD-5.2.1-Ausgabe existiert nicht. Sie sind der
  wahrscheinlichste Ort für Korrekturen, nicht die Regelzahlen.
- Die englischen Namen stehen in `nameEn` daneben, damit jede Zeile
  nachschlagbar bleibt.
- Waffenmeisterschaften tragen bewusst ihre **englischen** SRD-Namen
  (`Meisterschaft: Vex`), statt erfundene deutsche. Das ist eine offene
  Entscheidung, die einmal fallen und dann überall gelten sollte.

Suchbefehl für die wenigen verbliebenen Lücken:

Suchbefehl für offene Stellen:

```bash
grep -rn "TODO(unverified)" packages/character-creator/src/
```

---

## 8. Lizenz und Attribution

Der Inhalt stammt aus dem **SRD 5.2.1**, veröffentlicht von Wizards of the
Coast unter **CC-BY-4.0**. Jeder Katalogeintrag trägt seine Herkunft in
`source` (`SRD_SOURCE`), damit die Angabe nicht an einer einzelnen Stelle im
Code hängt.

**Noch zu erledigen:**

- Eine sichtbare Attributionszeile in der Oberfläche des Erstellers und im
  Impressum. CC-BY verlangt Namensnennung — ein Feld im Datenmodell erfüllt
  das nicht.
- Die deutschen Namen sind **Übersetzungen dieses Projekts**, keine Zitate:
  eine offizielle deutsche SRD-5.2.1-Ausgabe gibt es nicht. Das gehört
  dokumentiert, damit niemand sie für amtlich hält.
- Inhalte, die **nicht** im SRD stehen (die ~40 weiteren Unterklassen,
  die meisten Talente, Zauber aus späteren Büchern), dürfen **nicht** aus
  einer kommerziellen Quelle nachgetragen werden. Wer sie will, braucht
  einen Eigenbau-Pfad — siehe unten.

---

## 9. Was Eigenbau-Inhalte bräuchten

Der Ersteller kennt heute nur den mitgelieferten Katalog. Für eine eigene
Welt ist das zu wenig — UWE ist ein Welten-Editor, nicht nur ein
Regel-Frontend.

Fehlt dafür:

- Ein Speicherort für welt-eigene Völker, Klassen, Hintergründe und Zauber
  (Tabelle oder JSON-Spalte an der Welt).
- Eine Pflegeoberfläche im Studio.
- Eine Zusammenführung „SRD + Welt-Eigenes" im Katalog des Erstellers, mit
  Herkunftsmarke auf jeder Kachel.
- Eine Entscheidung des Spielleiters, **welche** Quellen in seiner Welt
  erlaubt sind — D&D Beyond hat dafür seine Quellen-Matrix.
