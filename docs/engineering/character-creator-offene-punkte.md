# Charakter-Ersteller — offene Punkte

Stand: 2026-08. Der Ersteller **funktioniert**: Vom leeren Entwurf bis zum
Charakter in der Datenbank läuft die Strecke, belegt an zwei Charakteren
(Kämpfer mit Katalog-Hintergrund, Paladin mit Eigenbau). Diese Datei sammelt,
was danach noch offen ist — damit man später weitermachen kann, ohne die
Befunde neu zu erarbeiten.

Zwei Nachbardokumente:

- [character-creator-missing-data.md](character-creator-missing-data.md) — welche
  **Daten** fehlen (Zauber ab Grad 2, Klassentabellen, Rüstungswerte …).
- Der Prüfstand mit Aufnahmen und Kritiker-Urteilen je Bauteil lag als
  Artefakt vor; die Urteile sind hier zusammengefasst.

Sortiert nach **Verhältnis von Nutzen zu Aufwand**, nicht nach Thema.

---

## 0. Was nachweislich läuft

Damit niemand Vorhandenes noch einmal baut:

| Bereich | Stand |
|---|---|
| Neun Schritte, nicht-linear, per Fragment verlinkbar | läuft |
| Entwurf übersteht Neuladen (`sessionStorage`, an den Tab gebunden) | läuft |
| Katalog SRD 5.2.1: 9 Völker/24 Abstammungen, 12 Klassen, 4 Hintergründe, 19 Talente, 84 Zauber, 38 Waffen, 7 Pakete | läuft |
| Vier Attributs-Methoden (Standardwerte, Punktekauf, 4W6, manuell) | läuft |
| Eigenbau-Hintergrund nach SRD-Bauplan | läuft |
| Anlegen in **einer** Transaktion, serverseitig neu geprüft | läuft |
| Seite + Textblock + Bogen + Zauber + Inventar | läuft |
| Die vier vormals toten Spalten `species`/`background`/`features`/`bio` | gefüllt, versioniert |
| Kein waagerechter Beschnitt bei 1440 und 390 | geprüft an 18 Aufnahmen |

---

## 1. Prüf-Lücken — zuerst, weil billig und blind

### 1.1 Das dunkle Thema wurde nie erfasst

**Befund:** Alle 18 „dunklen" Aufnahmen waren **byte-identisch** zu den hellen.
Der Screenshot-Lauf setzte `colorScheme: "dark"` im Browser — UWE rendert das
Thema aber serverseitig aus einer Einstellung (`buildVisualThemeHtmlAttributes`
aus `settings.app.theme`), nicht aus `prefers-color-scheme`.

**Folge:** Hell/Dunkel-Parität ist für **kein** Bauteil belegt. Der Kritiker
weist zusätzlich darauf hin, dass der Nacht-Zweig in `tokens-v3.css` die
`*-ink`-Token auf die reine Füllfarbe zurücksetzt und damit die
AA-Korrekturen des Tag-Zweigs verwirft — dunkler Akzenttext ist also nicht nur
ungeprüft, sondern womöglich unter der Schwelle.

**Zu tun:** Im Aufnahme-Werkzeug das Thema über die Einstellung oder den
`ThemeModeToggle` umschalten, dann alle Schritte neu aufnehmen und die
Kontraste messen.

### 1.2 Die a11y-Prüfung lief nie gegen die neue Oberfläche

`e2e/portal-a11y.spec.ts` fährt axe (WCAG A/AA) in hell und dunkel bei 390,
768 und 1440 px und prüft zusätzlich Schriftgrößen, Trefferflächen und
Überschriften-Struktur. Sie braucht laufende Server und eine geseedete
Datenbank und wurde für den Ersteller **nicht** ausgeführt.

Die Bauweise folgt den Regeln (`aria-pressed`-Knöpfe, `fieldset`+`legend`,
echte `<label>`, Farbe nie allein) — das ist Sorgfalt, kein Nachweis.

**Zu tun:** Route in die Prüfliste aufnehmen und laufen lassen.

### 1.3 Der Zauber-Schritt wurde mit der falschen Klasse aufgenommen

Die Aufnahme entstand mit einem Kämpfer, nicht mit einem Zauberer — sichtbar
war nur der Leerzustand (`tiles: 0`). Zähler, Suche und Schulfilter existieren
im Code, sind aber **in keiner Aufnahme belegt**. Der Kritiker konnte den
Schritt deshalb nicht über 2 bewerten.

**Zu tun:** Mit `zauberer` neu aufnehmen (das Werkzeug kennt den Fall bereits,
`CASTER_DRAFT` in `shoot-wizard.mjs`).

---

## 2. Gestaltung — was die Kritiker am härtesten getroffen hat

Alle zwölf Bauteile fielen in Runde 1 durch (8–12 von 24 Punkten). Vier
gewannen ihren Blindvergleich (Fertigkeiten, Ausrüstung, Vorschau-Leiste;
Hintergrund unentschieden), die übrigen gingen an die Referenz.

### 2.1 Keine einzige Option über der Falz

**Der teuerste Einzelbefund.** Bei 1440×900 begann die erste Kachelreihe erst
bei ~877 px; im Klassenschritt lag die Falz sogar noch über dem Raster. Wer
den Ersteller öffnet, sieht Überschrift, Lede, Schrittleiste, Hinweisfeld,
Zwischenüberschrift und Suchzeile — und **keine Wahlmöglichkeit**.

Ein Teil ist behoben (Suchfeld-Umbruch, engerer Vorspann). Der Rest bleibt:
Das Hinweisfeld zu den 2024er Regeln ist ein Einmal-Text und gehört
zusammenklappbar; die Kopfzeile der Seite und der Kopf des Schritts sagen
teilweise dasselbe.

### 2.2 Material ist behauptet, nicht gerendert

Gemessen: Seitenfläche **Standardabweichung 0,00**. Das viel kommentierte Korn
liegt bei `opacity: .035` und misst 0,46–0,48 — **unter einer 8-Bit-Stufe**,
also unsichtbar. Der Höhenunterschied Kachel↔Seite beträgt 16/255, und
`--uwe-surface-2` zu `-3` löst nur zwei statt drei Stufen auf.

Die Kommentare in `wizard.css` versprechen „Korn, Kante und Tiefe". Entweder
das Korn wird sichtbar (höhere Deckkraft, gröbere Frequenz) oder der Anspruch
kommt aus den Kommentaren heraus.

### 2.3 Die Würfel sind ein Wackeln, keine Physik

24 Zahlenquadrate à 40 px, eine gemeinsame 2D-Hüpf-Animation über 420 ms, ohne
Versatz, ohne Perspektive, ohne Schatten, ohne Augen. Gegen die
physiksimulierten 3D-Würfel der Referenz ist das kein Vergleich. Es gibt auch
keine Wurfgruppen, zwischen denen man wählen könnte.

**Anmerkung:** Ausdrücklich als nicht vordringlich zurückgestellt — die
Erstellung funktioniert ohne. Steht hier der Vollständigkeit halber.

### 2.4 Die Übersicht verdoppelt die Vorschau-Leiste

Heldenkarte und vier Wertekacheln wiederholen wortgleich, was 60 px weiter
rechts schon steht — mit zwei Vokabularen für dieselbe Zahl („TP" vs.
„TREFFERPUNKTE"). Da die Referenz gar keinen Übersichtsschritt hat (der
Charakterbogen *ist* die Übersicht), muss unserer sich rechtfertigen.

Ebenfalls dort: Der Knopf „Charakter anlegen" liegt auf Schritt 9 unter einem
ganzen Bildschirm Bogenraster, und der Fußzeilen-Platz, an den er gehört,
trägt nur „Es fehlen noch Entscheidungen." — ohne Symbol, ohne Anzahl, ohne
Sprungziel, gemessen bei **4,50:1** Kontrast (exakt auf der AA-Linie) für den
wichtigsten Satz des Bildschirms.

### 2.5 Kleinere, klar benannte Mängel

| Ort | Befund |
|---|---|
| Beschreibung | Kein Porträt, kein Avatar, kein Upload. Zwei einsame Eingabefelder füllen ein 1440×900-Fenster. Die Anzeigeschrift trägt **Werte**, die Monoschrift ihre **Beschriftungen** — genau verkehrt. |
| Fertigkeiten | Vom Hintergrund gesetzte Fertigkeiten sehen aus wie selbst gewählte. Der Zähler meldet „vollständig", während drei Zeilen tiefer eine Warnung plus „Aufräumen" steht — `remaining` zählt veraltete Auswahlen mit. |
| Hintergrund | Sieben Filterpillen für vier Einträge. |
| Schrittleiste | Kein Zustand „besucht, aber unvollständig" — ein angefangener Schritt sieht aus wie ein nie geöffneter. Die Daten dafür liefert `validateDraft` bereits. |
| Fußzeile | Zeigt nur `issues[0]` des **aktuellen** Schritts, unter `data-tone="blocked"`, obwohl nichts blockiert. |
| Aufklapper | Kein `:focus-visible` auf `<summary>`. |
| Typografie | Space Mono trägt den gesamten Fließtext; daher ~105 Zeichen pro Zeile in der Seiten-Lede und ~28 in den Karten. |

---

## 3. Bekannte Fehler außerhalb des Erstellers

Beim Bauen gefunden, **nicht** behoben, weil außerhalb des Auftrags — aber der
Ersteller ist jetzt der Hauptlieferant dieser Daten:

1. **Zauberplätze werden für manche Klassen falsch gerechnet.**
   `character-spell-service.ts` vergleicht Klassennamen gegen einen Satz ohne
   Umlaute (`"waldlaufer"`), der Ersteller schreibt aber den Anzeigenamen
   (`"Waldläufer"`). Die Erkennung greift dann nicht. `spellcasting.ability`
   wird explizit geschrieben, SG und Angriffsbonus stimmen also — die
   **Plätze** nicht.
2. **Warlock als Halbzauberer.** Derselbe Dienst behandelt den
   Hexenpakt-Magier als Halb- statt Pakt-Zauberer.
3. **`DndRulesEdition` verzweigt nichts.** Der Wert wird gespeichert, alle
   Formeln sind fest auf 2024 verdrahtet. Ein Charakter mit `dnd5e_2014` wird
   heute schlicht falsch gerechnet.
4. **`PortalCharacterView` gibt Volk, Hintergrund, Merkmale und Biografie
   nicht heraus.** Sie stehen jetzt in der Datenbank, der Bogen im Portal kann
   sie trotzdem nicht anzeigen.
5. **`CharacterService.update()` kann diese vier Spalten nicht ändern.** Wer
   seinen Hintergrund korrigieren will, kann es nicht.
6. **Mehrklassencharaktere sind unmöglich.** `bumpClasses` hebt bei unbekannter
   Klasse still die **erste** an, statt eine zweite anzulegen.
7. **Rüstungsklasse wird nie gerechnet.** Die Vorschau zeigt bewusst
   `10 + GES`; die gewählte Rüstung fließt nicht ein. Solange
   `EquipmentLine` keine strukturierten Rüstungswerte hat, geht es auch nicht.

---

## 4. Was der Ersteller inhaltlich noch nicht kann

- **Kein Porträt/Avatar** — weder Feld auf `Character` noch Upload-Pfad.
- **Kein Import** aus D&D Beyond, Roll20 oder einer JSON-Datei.
- **Keine Zufalls- oder Schnellerstellung** („würfle mir einen Charakter").
- **Keine Eigenbau-Inhalte außer dem Hintergrund** — welt-eigene Völker,
  Klassen und Zauber bräuchten einen Speicherort an der Welt und eine Pflege
  im Studio (siehe missing-data § 9).
- **Keine Quellen-Matrix** — der Spielleiter kann nicht bestimmen, welche
  Inhalte in seiner Welt erlaubt sind.
- **Keine CC-BY-Attribution in der Oberfläche.** Jeder Katalogeintrag trägt
  seine Herkunft im Datenmodell (`source`), aber die Lizenz verlangt eine
  **sichtbare** Nennung. Das ist eine rechtliche Restschuld, kein Komfort.

---

## 5. Werkzeuge, die es schon gibt

Wer weitermacht, muss das nicht neu bauen — sie liegen im Sitzungs-Ablagefach
(`scratchpad/`), nicht im Repo, und gehören bei Bedarf dorthin überführt:

| Werkzeug | Zweck |
|---|---|
| `shoot-wizard.mjs` | Nimmt alle neun Schritte auf; setzt vorab einen realistischen Entwurf in den `sessionStorage`, damit auch späte Schritte Inhalt haben. Prüft Beschnitt **elementweise** (die naive Dokument-Prüfung war blind, siehe unten). |
| `e2e-create.mjs` / `e2e-paladin.mjs` | Legen einen Charakter vollständig an und lesen ihn aus der Datenbank zurück. Der eigentliche Abnahmetest. |
| `ddb-parity-rubric.md` | Die Bewertungsvorlage der Kritiker (A–F, 0–4, harte Durchfaller). |
| `ddb-reference-steps.md` | Beschreibung der Referenz-Schritte in Prosa — die Vergleichsseite. Keine fremden Bildschirmfotos. |
| `progress.mjs` + `verdicts.json` | Erzeugen die Fortschrittsseite aus Aufnahmen und Urteilen. |

**Eine Falle, die zweimal zugeschnappt hat und dokumentiert bleiben sollte:**
Eine Überlaufprüfung über `documentElement.scrollWidth` ist in dieser App
**wirkungslos** — die Hülle hat `overflow: hidden`, überstehender Inhalt wird
abgeschnitten statt scrollbar, und die Breite wächst nie. Es muss jede
Elementkante gegen den Fensterrand geprüft werden, und Kinder eines
absichtlichen Waagerecht-Scrollers müssen ausgenommen sein.

---

## 6. Reihenfolge, wenn jemand weitermacht

1. **§ 1.1 + § 1.2** — dunkles Thema aufnehmen, a11y-Prüfung laufen lassen.
   Billig, und beides kann heute Fehler verstecken.
2. **§ 3.1** — die Zauberplatz-Erkennung. Ein falscher Bogen am Spieltisch
   wiegt schwerer als eine unschöne Kachel.
3. **§ 2.1** — Optionen über die Falz holen.
4. **§ 4** — sichtbare CC-BY-Nennung. Rechtliche Schuld, kleiner Aufwand.
5. Alles Weitere nach Geschmack.
