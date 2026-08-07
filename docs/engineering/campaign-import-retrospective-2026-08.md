# Retro: Neuimport von Dunkelsonne und Himmelsrouten

Stand: 7. August 2026

Quell-Repository: `Nehmo101/UWE-Kampagnen`

Analysierter Quellenstand: `93732be...`
Betroffene UWE-Bereiche: Dokumentimport, Kampagnen-Cockpit, Dungeon-Cockpit, Sessions, Backup und Command Center

## 1. Auftrag und Definition von „fertig“

Der Auftrag war größer als „Markdown in Seiten umwandeln“. Die Kampagnen sollten vollständig, nachvollziehbar und betriebsfähig in UWE ankommen. Fertig bedeutete deshalb:

1. Jede relevante Quelldatei wurde gelesen.
2. Kein Abschnitt verschwand still beim semantischen Umbau.
3. Jede Quest gehörte fachlich zu Kampagne und Story-Bogen.
4. Jeder Dungeon hatte eine Wurzel, Ebenen, Räume und eine Kampagnenzuordnung.
5. Interne Verweise waren auflösbar.
6. Ein erneuter Import durfte keine unkontrollierten Duplikate erzeugen.
7. Vor und nach dem Eingriff existierte eine wiederherstellbare Sicherung.
8. Der Import war anhand von Quelle, Revision und Inhalts-Hashes auditierbar.

Die ersten fünf Punkte wurden beim Neuaufbau der Live-Daten erfüllt. Die Punkte sechs bis acht waren im damaligen Importweg nur teilweise vorhanden und sind Gegenstand der sechs Verbesserungen dieser Änderung.

## 2. Ergebnis in Zahlen

### Dunkelsonne

- 905 Seiten im geprüften Kampagnenbestand
- 86 Quests
- 10 Story-Bögen
- 4 Dungeons
- 2 bewusst offene Inhaltsstummel
- 0 unzugeordnete Quests
- 0 verwaiste Dungeon-Ebenen
- 0 unaufgelöste Wikilinks im Abschlussaudit
- 0 unerwünschte Titelduplikate im Abschlussaudit

### Himmelsrouten

- 17.506 Quellzeilen
- 965 erzeugte beziehungsweise erkannte Seiten
- 24 Quests
- 15 Story-Bögen
- 447 explizite Wikilink-Vorkommen mit 168 Zielen
- 3 `siehe_auch`-Kanten
- 0 tote Ziele
- 2.500.969 Textzeichen
- Median des Seitentextes: 958 Zeichen
- 32 Seiten unter 240 Zeichen

Die 32 kurzen Seiten waren nicht 32 Importfehler. Davon waren:

- 13 `statblock_list`-Container,
- 15 `npc_list`-Container,
- 3 `handout_list`-Container,
- 1 echte Inhaltsseite: „Das Anlegefeld“ mit 228 Zeichen.

Die 31 Container besaßen jeweils 2 bis 19 Kinder und einen vollständigen Einleitungsrumpf. Sie werden vom Importer absichtlich nicht aufgelöst. „Das Anlegefeld“ war inhaltlich vollständig, unterschritt aber die selbst gesetzte Redaktionsheuristik um zwölf Zeichen. Das ist ein Quellenproblem, kein Datenverlust im Importer.

## 3. Was gut funktioniert hat

### 3.1 Der Import war messbar statt gefühlt vollständig

Der wichtigste gute Schritt war die Trennung zwischen „der Lauf war grün“ und „der Inhalt ist vollständig“. Dafür wurden zusätzlich zum eigentlichen Import gezählt:

- Quellzeilen und Quellzeichen,
- erzeugte Seiten,
- Seitentypen,
- kurze Seiten,
- Container und deren Kinder,
- Wikilink-Vorkommen und eindeutige Ziele,
- tote Links,
- Quests ohne Zuordnung,
- Dungeon-Ebenen ohne Wurzel,
- Titelduplikate.

Diese Zählungen entlarven Fehler, die ein erfolgreicher HTTP- oder CLI-Status nie zeigen würde. Ein Import kann technisch erfolgreich sein und dennoch 40 Quests als lose Lore-Seiten ablegen.

### 3.2 Die semantische Pipeline war deterministisch

Der Parser, die Rollenerkennung, der semantische Umbau und der Tree-Mapper ließen sich offline gegen die Originaldateien ausführen. Der vollständige Himmelsrouten-Lauf verarbeitete 17.506 Zeilen in rund 1,1 Sekunden. Das ermöglichte viele Wiederholungen ohne Risiko für die Live-Daten.

Die lokale KI blieb ein optionaler Feinschliff. Wenn sie nicht antwortete, entschied weiterhin das Regelwerk. Das war für Reproduzierbarkeit und Betriebssicherheit richtig.

### 3.3 Listencontainer wurden korrekt erhalten

Ein früher Verdacht war, kurze Sammelseiten seien beim Auflösen der Hierarchie übrig gebliebene Hüllen. Die Detailanalyse zeigte das Gegenteil: Rollen wie `npc_list`, `statblock_list` und `handout_list` sind eigenständige Navigations- und Kontextseiten.

Die Regel in `semantic/dissolve.ts`, Listenrollen nicht aufzulösen, ist daher richtig. Ein Container ist nicht wertlos, nur weil sein eigener Text kurz ist. Seine Bedeutung ergibt sich zusätzlich aus Titel, Einleitung, Reihenfolge und Kindmenge.

### 3.4 Zusammenführen statt Duplizieren war die richtige Grundidee

Kampagnenbände beschreiben zwangsläufig Personen, Orte und Fraktionen, die in der Welt bereits existieren. Das standardmäßige Zusammenführen namensgleicher Entwürfe verhinderte bei Dunkelsonne unter anderem Dubletten zentraler NSCs und Institutionen.

Positiv waren dabei drei Schutzmechanismen:

- Der bestehende Seitentyp wurde nicht überschrieben.
- Kampagne, Kanonstatus und Freigabe der Bestandsseite blieben erhalten.
- Ein Marker pro Entwurf verhinderte, dass derselbe Abschnitt bei jedem Lauf erneut angehängt wurde.

### 3.5 Zwei Durchgänge lösten Hierarchie und Beziehungen sauber

Erst wurden Seiten in Dokumentreihenfolge angelegt, danach explizite Beziehungen. Dadurch waren Eltern- und Ziel-IDs vorhanden, bevor sie gebraucht wurden. Dieses Muster ist robust und soll bleiben.

### 3.6 Die Sicherungsdisziplin war gut

Es gab Sicherungen vor und nach dem produktiven Umbau. Der abschließende Vollbackup-Lauf erzeugte:

`uwe-backup-full-2026-08-07T13-24-26-750Z.zip`

Damit war der Live-Eingriff rückholbar. Zusätzlich existierten Import-Undo-Daten für angelegte Seiten, Kanten und ergänzte Bestandsseiten.

### 3.7 Die Paketverifikation war belastbar

Der Dokumentimport bestand am Ende 230 von 230 Tests; nach den ergänzten Regressionstests waren es 233. Der Typecheck war grün. Eine einmalige `SQLITE_BUSY`-Warnung beim Setzen eines Pragmas war nicht fatal und kein Inhaltsfehler.

## 4. Was nicht gut genug war

### 4.1 Der Seitenbaum trug zu viele fachliche Bedeutungen

Vor dieser Änderung bedeutete `parentPageId` gleichzeitig:

- Navigationshierarchie,
- Story-Bogen einer Quest,
- Kapitelzuordnung eines Dungeons,
- teilweise Importstruktur.

Das ist bequem, aber fragil. Sobald eine Seite redaktionell verschoben wird, ändert sich unbeabsichtigt ihre fachliche Zuordnung. Eine Quest kann in einer Questsammlung navigieren, aber zu einem anderen Story-Bogen gehören. Ein Dungeon kann als Weltort einsortiert sein und dennoch in Akt III gespielt werden.

Konsequenz: Die fachlichen Kanten sind jetzt eigenständig:

- Quest → Story-Bogen über `questStoryArcId`
- Dungeon → Kampagne, Story-Bogen und Wurzelseite über `Dungeon`
- Session → beliebige Arbeitskontexte über `GameSessionFocus`

`parentPageId` bleibt Navigation, nicht Wahrheit über Dramaturgie.

### 4.2 Es fehlte ein echtes Dungeon-Domänenmodell

„Dungeon“ war zuvor vor allem ein Seitentyp. Das reichte für Darstellung, aber nicht für stabile Beziehungen, spätere Laufzustände oder eindeutige Wurzeln. Das neue Modell macht explizit:

- zu welcher Welt der Dungeon gehört,
- zu welcher Kampagne er gehört,
- welche Seite seine Wurzel ist,
- welchem Story-Bogen er zugeordnet ist,
- unter welchem stabilen Namen und Slug er geführt wird,
- welchen Vorbereitungsstatus er hat.

Eine Wurzelseite kann nur einen Dungeon-Datensatz besitzen. Damit kann das Cockpit nicht mehr versehentlich zwei fachliche Dungeons aus derselben Wiki-Wurzel ableiten.

### 4.3 Sessions hatten nur ein Kapitel als Hauptkontext

Eine Spielsession kann gleichzeitig einen Story-Bogen, einen Dungeon, drei Räume und zwei Quests berühren. `storyArcPageId` konnte diese Realität nicht ausdrücken. Lose `linkedPages` sagten wiederum nicht, welche Rolle eine Seite spielte und was gerade aktuell war.

Das neue Modell erlaubt die Rollen:

- `chapter`
- `dungeon`
- `room`
- `quest`
- `reference`

Jeder Fokus hat eine Reihenfolge, und höchstens einer ist `isCurrent`. Das alte `storyArcPageId` bleibt vorerst für bestehende Aufrufer erhalten und wird mit dem Kapitel-Fokus synchronisiert.

### 4.4 Herkunft und Synchronisation waren nicht dauerhaft gespeichert

Der Undo-Eintrag dokumentierte einen Lauf, war aber kein dauerhaftes Abbild der Quellenbeziehung. Es fehlten Antworten auf:

- Welche Repository-Revision lieferte diese Seite?
- Hat sich der Quellabschnitt seit dem letzten Lauf geändert?
- Wurde die Seite vom Import angelegt oder nur ergänzt?
- Welche Seite ist aus der Quelle verschwunden?
- Darf der Sync diese Seite löschen?

Neu sind deshalb `DocImportSource` und `DocImportPageBinding`. Gespeichert werden:

- normalisierter Quellpfad,
- Repository-URL,
- Quellrevision,
- SHA-256 des gesamten Dateisatzes,
- SHA-256 pro Seitenentwurf,
- UWE-Seiten-ID,
- Besitzkennzeichen,
- Zeitpunkt und letzte Revision.

Die Vorschau und das Ergebnis melden `added`, `changed`, `unchanged`, `removed` und `protected`.

### 4.5 Entfernen war ohne Besitzmodell zu gefährlich

„In der Quelle nicht mehr vorhanden“ heißt nicht automatisch „in UWE löschen“. Eine zusammengeführte Seite kann lange vor dem Import existiert haben und weitere redaktionelle Inhalte tragen.

Die neue Sync-Regel lautet:

- `ownedPage=true`: Die Seite wurde durch diese Quelle neu angelegt und darf im expliziten Sync-Modus entfernt werden.
- `ownedPage=false`: Die Quelle wurde in eine bestehende Seite integriert. Beim Verschwinden wird nur `protected` gemeldet; die Seite bleibt bestehen.
- Ohne `syncMode: sync` wird gar nichts entfernt.

Das ist konservativ und absichtlich so.

### 4.6 Quellenmetadaten waren teilweise falsch

Fünf aktive Dunkelsonne-Dateien trugen `kampagnen: [FTKJ]`. Der Inhalt wurde dadurch semantisch der falschen Kampagne angeboten. Betroffen waren das Kampagnenbuch und die vier Dungeon-Dateien.

Die aktiven Dateien wurden auf `kampagnen: [Dunkelsonne]` korrigiert. Historische Ausgangsfassungen und Beispiele im Format-Handbuch wurden nicht umgeschrieben, weil sie keine aktiven Importquellen sind und als historische beziehungsweise illustrative Artefakte ihren Kontext behalten sollen.

### 4.7 Die Kurzseiten-Heuristik war zu pauschal

„Unter 240 Zeichen“ ist ein guter Hinweis, aber kein Fehlerkriterium. Die Heuristik muss Rollen, Kinderzahl und Zweck berücksichtigen.

Künftig gilt:

- Kurze Blattseite ohne Kinder: redaktionell prüfen.
- Kurzer Listencontainer mit Kindern: meist korrekt.
- Raumseiten dürfen knapp sein, brauchen aber mindestens Zweck, Eindruck und spielrelevante Information.
- Ein Befund wird erst durch Kontext zum Fehler.

### 4.8 Der Abschlussaudit war Handarbeit

Viele entscheidende Prüfungen wurden als einmalige Probeskripte ausgeführt. Das lieferte Sicherheit für diesen Lauf, aber keine dauerhafte Garantie.

Neu ist `campaign:check`. Die Prüfung findet unter anderem:

- Quests ohne Kampagne,
- Quests ohne Story-Bogen,
- kampagnenfremde Story-Bögen,
- Dungeon-Seiten ohne Domänenzeile,
- widersprüchliche Dungeon-Daten,
- verwaiste Dungeon-Ebenen,
- unpassende Session-Fokusrollen,
- mehrere aktuelle Session-Fokusse,
- doppelte Titel innerhalb einer Kampagne,
- tote Wikilinks.

Ein Contract-Test stellt sicher, dass das Gate und beide Prisma-Schemata nicht still aus dem CI-Pfad verschwinden.

## 5. Technische Ursachenanalyse

### Ursache A: Struktur wurde mit Semantik verwechselt

Markdown-Überschriften liefern eine Baumstruktur. Dieser Baum sagt zunächst nur: „Dieser Abschnitt steht unter jenem Abschnitt.“ Er sagt nicht zwangsläufig: „Diese Quest gehört dramaturgisch zu diesem Akt.“ Der Import hatte diese beiden Aussagen zu lange gleichgesetzt.

### Ursache B: Klassifikation kann Inhalt erkennen, aber keine fehlende Redaktion erfinden

Der Importer kann eine Überschrift als Quest, NSC oder Raum erkennen. Er kann aber nicht sicher wissen, welchem von mehreren Story-Bögen eine flache Questliste zugeordnet werden soll. Wo die Quelle diese Information nicht trägt, bleibt nur eine redaktionelle Zuordnung.

### Ursache C: Idempotenz war abschnittsbezogen, nicht quellensynchron

Der Merge-Marker verhinderte doppelte Anhänge. Er wusste aber nicht, ob sich ein markierter Abschnitt geändert hatte oder aus der Quelle entfernt worden war. Dafür braucht es dauerhafte Bindungen und Hashes.

### Ursache D: Erfolgsmetriken waren zu technisch

„0 Exceptions“ und „965 Seiten“ sind notwendig, aber nicht hinreichend. Eine korrekte Kampagne braucht fachliche Invarianten. Genau diese Invarianten bildet das neue Gate ab.

## 6. Der verbesserte Sollprozess

### Phase 1: Quelle vorbereiten

1. Repository auf eine bekannte Revision bringen.
2. Aktive Quelldateien von Werkstatt, Historie und Exportartefakten trennen.
3. Frontmatter validieren.
4. Kampagnenname und Profil prüfen.
5. Quest- und Dungeonzuordnungen explizit redigieren.

### Phase 2: Trockenlauf

1. Dateien lesen und Größenlimits prüfen.
2. Deterministischen Plan bauen.
3. Rollen und Typen zählen.
4. Strukturbericht prüfen.
5. Sync-Bericht gegen die vorige Quellenbindung prüfen.
6. Tote Links und Dubletten auflisten.
7. Kurze Blattseiten separat von Containern bewerten.

### Phase 3: Sicherung

1. Vollbackup erzeugen.
2. Archivpfad und Erstellzeit protokollieren.
3. Bei besonders großen Umbauten zusätzlich einen selektiven Vorher-Snapshot behalten.

### Phase 4: Schreiben

1. Bestätigten Plan neu deterministisch erzeugen.
2. Seiten schreiben oder geschützt zusammenführen.
3. Beziehungen schreiben.
4. Quest-, Dungeon- und Session-Domänenkanten setzen.
5. Quellenbindung und Hashes speichern.
6. Nur im expliziten Sync-Modus import-eigene Altseiten entfernen.

### Phase 5: Abschlussaudit

1. `campaign:check` ausführen.
2. Mengen Quelle ↔ Plan ↔ Datenbank vergleichen.
3. Alle Befunde klassifizieren: Importfehler, Quellenmangel oder bewusste Ausnahme.
4. Pakettests, Typecheck, Lint und Migration-Check ausführen.
5. Nachher-Backup erzeugen.

## 7. Qualitätskriterien für künftige Importe

Ein Kampagnenimport ist erst freigabefähig, wenn:

- keine Datei still übersprungen wurde,
- keine Quest ohne Kampagne oder Story-Bogen bleibt,
- jede Dungeon-Wurzel genau einen Dungeon-Datensatz hat,
- jede Dungeon-Ebene unter einer gültigen Wurzel liegt,
- keine Session mehr als einen aktuellen Fokus hat,
- alle Wikilinks entweder auflösbar oder bewusst dokumentiert sind,
- keine unerwünschten Titelduplikate existieren,
- der Sync-Bericht redaktionell geprüft ist,
- Quelle, Revision und Hash gespeichert sind,
- Vorher- und Nachher-Sicherung vorhanden sind,
- die Cloud-CI grün ist.

## 8. Was bewusst noch nicht automatisiert wird

UWE soll keine dramaturgische Wahrheit erfinden. Folgende Entscheidungen bleiben redaktionell:

- Zu welchem Story-Bogen eine in der Quelle flach geführte Quest gehört.
- Ob zwei ähnlich benannte Personen wirklich identisch sind.
- Ob ein kurzer Raum absichtlich minimalistisch ist.
- Ob ein aus der Quelle entfernter, aber geschützter Merge-Abschnitt aus einer Bestandsseite redaktionell entfernt werden soll.
- Ob ein Story-Bogen in Kapitel, Nebenbogen oder Fraktionsbogen umbenannt wird.

Automatisierung soll fehlende Entscheidungen sichtbar machen, nicht sie verstecken.

## 9. Schlussfolgerung

Der Neuimport selbst war inhaltlich erfolgreich: Die zwei Kampagnen kamen vollständig, verlinkt und ohne offene Zuordnungsfehler in UWE an. Der größere Gewinn der Retro ist jedoch die Architekturänderung danach. Kampagnen, Dungeons und Sessions sind nun fachlich verknüpft, ohne vom Wiki-Baum abhängig zu sein. Der Import besitzt eine dauerhafte Herkunft, ein Besitzmodell und einen Sync-Bericht. Die Sicherung kennt die neuen Daten. Und ein wiederholbares Konsistenz-Gate ersetzt den wichtigsten Teil der einmaligen Handprüfung.

Die zentrale Lehre lautet: Ein Dokumentimport ist kein Parserprojekt. Er ist ein kontrollierter Datenmigrationsprozess mit fachlichen Invarianten, Eigentumsregeln, Provenienz, Wiederholbarkeit und Rückweg.
