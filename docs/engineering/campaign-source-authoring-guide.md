# UWE-Kampagnen: verbindlicher Quellenleitfaden

Dieser Leitfaden beschreibt, wie Kampagnendateien aussehen müssen, damit UWE sie vollständig, deterministisch und ohne redaktionelle Nacharbeit importieren kann.

## 1. Grundregeln

- Kodierung: UTF-8.
- Zeilenenden: LF oder CRLF; im selben Dokument nicht mischen.
- Dateiendungen: `.md`, `.markdown` oder `.txt`; `.md` ist der Standard.
- Eine Datei braucht einen stabilen, sprechenden Namen.
- Binärdateien gehören nicht mitten in den Markdown-Baum.
- Generierte Exporte, Werkstattdateien und historische Fassungen liegen unter `_werkstatt/` oder einem anderen klar ausgeschlossenen Pfad.
- Die aktive Fassung ist eindeutig. Keine Dateien wie `final-neu-wirklich-final-2.md`.

## 2. Frontmatter

Jede aktive Hauptdatei beginnt mit YAML-Frontmatter:

```yaml
---
titel: Dunkelsonne
kampagnen: [Dunkelsonne]
profil: campaign-book
sprache: de
status: aktiv
---
```

Pflichtfelder:

- `titel`: menschlich lesbarer Titel.
- `kampagnen`: exakte UWE-Kampagnennamen oder Slugs.
- `profil`: das vereinbarte Importprofil.

Empfohlen:

- `sprache`
- `status`
- `version`
- `quelle`

Der Kampagnenname muss stimmen. Dunkelsonne-Dateien dürfen nicht `kampagnen: [FTKJ]` tragen. Groß-/Kleinschreibung sollte der UWE-Kampagne entsprechen, auch wenn der technische Abgleich normalisiert.

## 3. Überschriftenhierarchie

Es gibt genau eine H1 pro Dokument. Darunter steigt die Tiefe ohne Sprünge:

```markdown
# Dunkelsonne

## Akt I — Die Spur

### Quest: Das verschwundene Licht

#### Szene: Am schwarzen Brunnen
```

Nicht zulässig:

```markdown
# Dunkelsonne

#### Plötzlich vier Ebenen tiefer
```

Überschriften sind keine Schmuckelemente. Jede Überschrift erzeugt potenziell eine Seite oder einen Container. Reine typografische Zwischenzeilen werden fett gesetzt, nicht als Überschrift.

## 4. Story-Bögen und Quests

Eine Quest braucht zwei fachliche Angaben:

- Kampagne
- Story-Bogen

Die sichere Quellenform ist, Quests direkt unter dem Story-Bogen zu führen:

```markdown
## Story-Bogen: Der Fall der Sonnennadel

### Quest: Der stumme Bote

**Status:** offen

**Aufhänger:** ...

**Ziel:** ...

**Konsequenz bei Erfolg:** ...

**Konsequenz bei Scheitern:** ...
```

Eine flache globale Questliste ist nur ein Katalog, keine eindeutige dramaturgische Zuordnung. Wenn eine Quest aus Navigationsgründen zusätzlich in einem Katalog erscheinen soll, wird sie dort verlinkt, nicht ein zweites Mal vollständig angelegt.

Empfohlene Mindeststruktur jeder Quest:

- Aufhänger
- Ziel
- Auftraggeber oder Auslöser
- relevante Orte
- relevante NSCs oder Fraktionen
- Hindernisse
- Erfolg
- Scheitern
- Folgequests
- Status

Questtitel müssen eindeutig sein. Generische Titel wie „Die Suche“ sollten einen qualifizierenden Zusatz erhalten.

## 5. Dungeons

Ein Dungeon ist eine eigene aktive Datei oder ein klar abgegrenzter Abschnitt:

```markdown
# Dungeon: Der Magisterturm

## Überblick

## Zugang

## Ebene 1 — Empfang

### Raum 1.1 — Die Wachhalle

## Ebene 2 — Observatorium

### Raum 2.1 — Die Sternenlinse
```

Pflichtinhalte der Wurzel:

- Zweck in der Kampagne
- sichtbarer Eindruck
- Zugang und mögliche Ausgänge
- Fraktionen oder Bewohner
- globale Gefahren
- Belohnungen oder Erkenntnisse
- zugehöriger Story-Bogen

Jede Ebene liegt direkt oder eindeutig unter der Dungeon-Wurzel. Räume liegen unter einer Ebene oder, bei einstufigen Dungeons, direkt unter der Wurzel.

Empfohlene Mindeststruktur eines Raums:

- erster Eindruck
- spielrelevante Merkmale
- Bewohner oder Gegner
- Gefahr, Rätsel oder Interaktion
- Funde
- Ausgänge und Verbindungen

Raumnummern müssen innerhalb des Dungeons eindeutig sein. Eine Raumnummer ist Navigation, kein Seitentitelersatz; „Raum 12“ braucht zusätzlich einen sprechenden Namen.

## 6. NSCs, Fraktionen, Orte und Gegenstände

Entitäten werden an einer kanonischen Stelle vollständig beschrieben. Andere Abschnitte verwenden Wikilinks.

```markdown
[[Nepurga]]
[[Magisterturm|der Turm des Magisters]]
```

Aliase gehören an die kanonische Entität. Zwei Schreibweisen dürfen nicht zu zwei vollständigen Seiten führen.

Für NSCs empfehlen sich:

- Rolle
- Motivation
- Auftreten
- Wissen
- Ressourcen
- Beziehung zur Kampagne
- Werteblock, falls erforderlich

Für Fraktionen:

- Agenda
- Führung
- Ressourcen
- Verbündete
- Gegner
- aktuelle Lage

## 7. Listencontainer

Sammelseiten sind erlaubt und sinnvoll:

- NSC-Listen
- Werteblocklisten
- Handoutlisten
- Ortsverzeichnisse

Ein Container braucht:

- eine erklärende Einleitung,
- einen klaren Zweck,
- mindestens ein Kind,
- eine stabile Überschrift.

Kurze Container sind kein Qualitätsfehler. Kurze Blattseiten ohne Kinder werden dagegen redaktionell geprüft.

## 8. Wikilinks

Zielnamen müssen einer existierenden oder im selben Import erzeugten Seite entsprechen.

Erlaubt:

```markdown
[[Zielseite]]
[[Zielseite|sichtbarer Text]]
[[Zielseite#Abschnitt]]
```

Nicht empfohlen:

- wechselnde Schreibweisen ohne Alias,
- Links auf Überschriften, die später nur dekorativ sind,
- rohe Dateipfade als fachliche Links,
- Links auf historische Werkstattdateien.

Vor Freigabe muss die Liste toter Wikilinks leer sein oder jede Ausnahme dokumentiert werden.

## 9. Explizite Beziehungen

`siehe_auch` und andere explizite Beziehungen werden nur verwendet, wenn eine fachliche Kante gemeint ist. Ein beiläufig erwähnter Name braucht keine zusätzliche Datenbankkante; dafür genügt ein Wikilink.

Beziehungen sollten gerichtet und verständlich sein. Das Ziel wird mit seinem kanonischen Namen genannt.

## 10. Keine Information in Dateinamen verstecken

Der Import liest Inhalt und Struktur. Bedeutungen, die nur im Dateinamen stehen, sind fragil.

Schlecht:

`DS_A3_Q17_final.md`

Besser:

`dunkelsonne/akte/akt-3/quest-das-gebrochene-siegel.md`

Noch wichtiger: Im Dokument selbst stehen Kampagne, Story-Bogen und Questtitel ausgeschrieben.

## 11. Umgang mit historischen Fassungen

Historische Quellen liegen unter `_werkstatt/`, `_archiv/` oder einem gleichwertig klaren Pfad. Sie werden nicht zusammen mit aktiven Dateien importiert.

Historische Metadaten dürfen den damaligen Zustand zeigen. Sie werden nicht massenhaft auf den heutigen Kampagnennamen umgeschrieben, wenn dadurch Quellenhistorie verloren geht.

## 12. Importparameter im Command Center

Für einen reproduzierbaren Lauf werden zusätzlich zur Pfadauswahl übergeben:

- `repository`: kanonische Repository-URL
- `sourceRevision`: vollständiger Commit-Hash
- `syncMode`: `append` oder `sync`

`append` schreibt und bindet, löscht aber nichts.

`sync` darf Seiten entfernen, wenn alle Bedingungen erfüllt sind:

1. Die Seite war an genau diese Quelle gebunden.
2. Die Seite wurde von dieser Quelle angelegt (`ownedPage=true`).
3. Der Quellschlüssel fehlt im neuen Plan.

Zusammengeführte Bestandsseiten sind geschützt und erscheinen im Bericht als `protected`.

## 13. Vorschau lesen

Vor dem Schreiben werden mindestens geprüft:

- Dateizahl
- Seitenzahl
- Seitenzahl pro Datei
- Typverteilung
- Strukturzusammenfassung
- Warnungen
- ungelöste Links
- Stichprobe des Baums
- hinzugefügte Seiten
- geänderte Seiten
- unveränderte Seiten
- zu entfernende import-eigene Seiten
- geschützte Bestandsseiten

Ein überraschend großer `changed`-Wert kann auf eine beabsichtigte Neufassung, aber auch auf instabile Schlüssel oder eine Parseränderung hindeuten.

## 14. Redaktionscheckliste vor dem Import

- [ ] Nur aktive Dateien liegen im Importpfad.
- [ ] Frontmatter ist vollständig.
- [ ] Kampagnenname stimmt exakt.
- [ ] Es gibt genau eine H1 je Hauptdokument.
- [ ] Überschriftsebenen springen nicht.
- [ ] Jede Quest liegt unter ihrem Story-Bogen.
- [ ] Jeder Dungeon hat Wurzel, Ebenen und Räume.
- [ ] Kein Raum hängt außerhalb seines Dungeons.
- [ ] Entitäten werden nicht doppelt vollständig beschrieben.
- [ ] Wikilinks verwenden kanonische Namen oder Aliase.
- [ ] Tote Links sind behoben.
- [ ] Kurze Blattseiten wurden geprüft.
- [ ] Repository und Commit-Hash sind bekannt.

## 15. Abnahmecheckliste nach dem Import

- [ ] Quellen-, Plan- und Datenbankmengen sind plausibel.
- [ ] `campaign:check` ist grün.
- [ ] Keine Quest ist unzugeordnet.
- [ ] Jede Dungeon-Wurzel besitzt genau einen Dungeon-Datensatz.
- [ ] Keine Dungeon-Ebene ist verwaist.
- [ ] Keine unerwünschten Titelduplikate existieren.
- [ ] Keine Wikilinks sind tot.
- [ ] Der Sync-Bericht wurde geprüft.
- [ ] Importquelle, Revision und Hash sind gespeichert.
- [ ] Vorher- und Nachher-Backup existieren.
- [ ] Die relevanten Tests und die GitHub-Cloud-CI sind grün.

## 16. Goldene Regel

Alles, was für Spielleitung, Dramaturgie oder Wiederherstellung wichtig ist, muss explizit in Inhalt oder Metadaten stehen. Der Importer darf Struktur erkennen und Regeln prüfen; er darf fehlende Kampagnenlogik nicht erraten.
