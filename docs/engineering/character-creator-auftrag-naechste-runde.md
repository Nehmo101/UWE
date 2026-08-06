# Auftrag: Charakter-Ersteller, nächste Runde

Diese Datei ist ein **Arbeitsauftrag zum Weitergeben** — an einen Agenten oder an
einen Menschen, der diese Sitzung nicht miterlebt hat. Sie ist bewusst
selbsttragend: alles Nötige steht drin oder ist verlinkt.

Kopiere ab „Prompt" alles in einer frischen Sitzung ein.

---

## Prompt

Du arbeitest im Repo `/home/user/UWE` (UWE — selbst gehostetes Kampagnen- und
Alltags-Betriebssystem, deutschsprachig dokumentiert). Entwickle auf einem
eigenen Branch und pushe dorthin.

### Was schon da ist

Der **Charakter-Ersteller** im Portal ist gebaut und funktioniert: neun
Schritte unter `/auth/worlds/<welt>/characters/neu`, ein SRD-5.2.1-Katalog in
`packages/character-creator`, Anlegen über `createFullCharacter` in
`packages/player-hub` in einer Transaktion mit serverseitiger Gegenprüfung.
Zwei Charaktere wurden damit nachweislich bis in die Datenbank angelegt.

Lies zuerst, in dieser Reihenfolge:

1. `docs/engineering/wiki-als-spieldaten-katalog.md` — **der Entwurf, den du
   umsetzt.** 775 Zeilen, mit Schema, Feldformaten, Migrationspfad und einer
   Aufwandsschätzung in Stufen.
2. `docs/engineering/character-creator-offene-punkte.md` — **die Restliste.**
   Prüf-Lücken, Gestaltungsbefunde mit Messwerten, sieben Fehler im Umfeld.
3. `docs/engineering/character-creator-missing-data.md` — welche Daten fehlen.
4. `CLAUDE.md` und `AGENTS.md` — Architektur- und Qualitätsregeln des Projekts.

### Dein Auftrag

**Teil A — Wiki als Spieldaten-Katalog.** Setze den Entwurf um, Stufe 0 bis 4.
Stufe 5 (Klassen) ist ausdrücklich **nicht** Teil des Auftrags; der Entwurf
begründet in Abschnitt 7, warum.

Die Reihenfolge des Entwurfs ist bindend, weil jede Stufe auf der vorigen
steht. Halte nach **Stufe 1** an und melde dich: ab dort funktioniert das
Feature, und der Auftraggeber soll es sehen können, bevor du weiterbaust.

**Teil B — Die offenen Punkte.** Arbeite `character-creator-offene-punkte.md`
in der dort genannten Reihenfolge ab (§ 6). Die ersten vier sind:

1. **Dunkles Thema aufnehmen** (§ 1.1). Alle bisherigen „dunklen" Aufnahmen
   waren byte-identisch zu den hellen — UWE rendert das Thema serverseitig aus
   einer Einstellung, nicht aus `prefers-color-scheme`. Hell/Dunkel-Parität ist
   damit für **kein** Bauteil belegt.
2. **`e2e/portal-a11y.spec.ts` gegen den Ersteller laufen lassen** (§ 1.2).
   Lief nie. Braucht laufende Server und geseedete Datenbank.
3. **Die Zauberplatz-Erkennung reparieren** (§ 3.1). `character-spell-service`
   vergleicht Klassennamen ohne Umlaute (`"waldlaufer"`), der Ersteller
   schreibt den Anzeigenamen (`"Waldläufer"`). Für einige Klassen stimmen die
   Zauberplätze dadurch nicht. Ein falscher Bogen am Spieltisch wiegt schwerer
   als eine unschöne Kachel.
4. **Sichtbare CC-BY-Nennung** (§ 4). Der Katalog trägt seine Herkunft im
   Datenmodell, die Lizenz verlangt aber eine sichtbare Nennung. Rechtliche
   Restschuld, kleiner Aufwand.

Danach § 2 (Gestaltung) im Schleifenbetrieb, siehe unten.

### Die Schleife

Für jeden sichtbaren Baustein gilt: **bauen → aufnehmen → hart kritisieren
lassen → nachbessern → wieder aufnehmen.** Nicht „einmal bauen und für gut
befinden".

- Der Bewertungsbogen und die Referenzbeschreibung liegen nicht mehr vor
  (sie hingen an der letzten Sitzung). Baue sie neu oder arbeite gegen die
  konkreten, gemessenen Befunde in `character-creator-offene-punkte.md` § 2 —
  die sind belastbarer als ein frischer Bogen.
- **Der Kritiker ist ein eigener Agent, nicht du selbst.** Er bekommt die
  Bildschirmaufnahme, nicht den Code, und die Vorgabe: im Zweifel durchfallen
  lassen. „Kompetent" ist ein Durchfaller.
- Er muss **Pixel** beurteilen, nicht Absichten. In der letzten Runde
  behaupteten die Kommentare im CSS „Korn, Kante und Tiefe", gemessen wurde
  auf der Seitenfläche eine Standardabweichung von 0,00. Lass messen.
- Schleife pro Baustein, bis der Kritiker nichts Konkretes mehr findet — oder
  bis er nur noch Dinge nennt, die im Entwurf ausdrücklich ausgeschlossen sind.

### Der Abnahmetest

**„Die Seite rendert" ist kein Nachweis.** Der Nachweis ist: ein Charakter
steht danach vollständig in der Datenbank, und die Zahlen stimmen.

Für Teil A heißt das konkret: Lege im Studio eine Wiki-Seite an, ordne sie als
Spezies ein, trage drei Werte ein, gib sie frei — und baue dann im Portal
einen Charakter damit. Lies ihn aus SQLite zurück und prüfe, dass Tempo und
Dunkelsicht der Welt-Spezies in `combat` und `species` gelandet sind.

### Fallen, die in der letzten Runde zugeschnappt sind

Alle vier scheiterten **lautlos**. Sie kosten je eine Stunde, wenn man sie
nicht kennt.

1. **`transpilePackages`.** Jedes `@uwe/*`-Paket, das aus einer
   `"use client"`-Komponente gelesen wird, muss in
   `apps/portal/next.config.ts` unter `transpilePackages` stehen. Die Pakete
   liefern rohes TypeScript. Fehlt der Eintrag, kommt das Client-Bündel nicht
   zustande — **ohne Fehlermeldung**; die Seite steht für immer auf „Portal
   wird geladen…".
2. **Doppeldeutige Stern-Exporte.** Wird dasselbe Symbol aus zwei Modulen über
   `export *` re-exportiert, bricht das Barrel beim Verknüpfen und der Import
   liefert `undefined`, statt zu krachen.
3. **Deutsche Anführungszeichen.** `„so etwas"` mit ASCII-Zoll geschlossen
   beendet den String bzw. bricht JSX. Immer mit `“` (U+201C) schließen. Das
   ist in der letzten Runde in **vier** verschiedenen Dateien passiert, in
   Katalogdaten, in JSX und sogar in JSON, das ein Agent geschrieben hat.
4. **Der Entwicklungsserver taugt nicht für Bildschirmaufnahmen.** In
   headless Chromium gegen `next dev` hydriert React **gar nicht** — der
   HMR-WebSocket scheitert an der `proxy.ts` der App und reißt den
   Dev-Bootstrap mit. Anmeldeformulare fallen dann auf natives GET zurück.
   **Immer gegen einen Produktionsbau aufnehmen** (`next build` + `next start`),
   so wie es die E2E-Umgebung des Repos auch macht. Nötige Umgebungsvariablen:
   `AUTH_SECRET`, `UWE_SETUP_TOKEN`, `PUBLIC_BASE_URL`, `RUN_DB_SEED=false`.

Dazu eine **Messfalle**: Eine Überlaufprüfung über
`documentElement.scrollWidth` ist in dieser App wirkungslos — die Hülle hat
`overflow: hidden`, überstehender Text wird abgeschnitten statt scrollbar, die
Breite wächst nie. Auf dem Telefon war Fließtext mitten im Wort abgeschnitten,
während die Prüfung „kein Überlauf" meldete. Prüfe jede Elementkante gegen den
Fensterrand und nimm Kinder eines absichtlichen Waagerecht-Scrollers aus.

### Regeln des Projekts, die dich betreffen

- **Fachlogik gehört in `packages/`**, nie in Route Handler oder Komponenten.
- **Neue Dateien unter 700 Zeilen.** `scripts/file-size-baseline.json` wird
  **nie** erhöht.
- **Kein Cross-App-Import**, keine server-only Module in Client-Komponenten.
- **`dm_only`-Inhalte erreichen nie das Portal.** Der Ersteller läuft im
  Portal — der Katalog-Lader muss `stripDmSections` anwenden und darf nur
  `portalReleased`-Seiten liefern. Das ist die wichtigste einzelne Regel
  dieses Auftrags.
- **Dem Browser wird nichts geglaubt.** Der Entwurf wird serverseitig
  vollständig aus dem Katalog neu aufgebaut. Wenn der Katalog künftig aus der
  Datenbank kommt, muss die Server-Action ihn **erneut laden** — sonst ist die
  bestehende Gegenprüfung wieder offen.
- **Schema-Änderung heißt Migration**, und das neue Modell gehört in
  `PRISMA_MODEL_BOUNDARIES` **und** in die Backup-Abdeckung.
- **Bereichs-Skills nachziehen.** Wer eine Route oder ein Paket ergänzt, läuft
  `pnpm skills:sync` und schreibt den Prosa-Teil selbst.
  `scripts/area-skills-sync.test.ts` erzwingt es.

### Qualitätstor

Vor jedem Commit: `npx tsc --noEmit`, ESLint, die betroffenen Paket-Tests.
Vor dem Push zusätzlich `node scripts/file-size-budget-check.mjs`,
`node scripts/product-boundary-check.mjs`, `pnpm secret:scan`,
`node scripts/docs-check.mjs`, `node --import tsx --test
scripts/area-skills-sync.test.ts`. Bei größerem Umfang `pnpm ci:light`.

### Wie du berichtest

- **Melde Befunde, nicht Fortschritt.** „Zauberplätze stimmen für Waldläufer
  nicht, weil …" ist wertvoll; „Schritt 3 fertig" ist es nicht.
- **Korrigiere dich, wenn du dich geirrt hast.** In der letzten Runde stand in
  der Dokumentation, fünf Klassen fänden keinen passenden Hintergrund. Es sind
  drei — Barde und Hexenpakt-Magier haben im SRD 2024 nur ein Primärattribut.
  Der Fehler stammte aus einem Kritiker-Bericht und wurde ungeprüft
  übernommen. **Prüfe Zahlen aus Berichten gegen die Daten**, bevor du sie
  weiterträgst.
- **Behaupte nichts Ungeprüftes.** Wenn eine Prüfung nicht lief, schreib das
  hin, statt den Haken zu setzen.

### Was du nicht tun sollst

- **Keine Klassen** als Welt-Inhalt (Entwurf, Abschnitt 7).
- **Keine Regel-Engine.** Merkmalstexte werden angezeigt, nicht ausgewertet.
  Genau dieser Verzicht hält das Feature klein.
- **Den SRD-Katalog nicht in die Datenbank verschieben.** Er bleibt im Code,
  Welt-Inhalte kommen daneben. Der Entwurf begründet es.
- **Keine fremden Bildschirmfotos** in Artefakte oder Dokumente übernehmen.
- **Die Baseline für Dateigrößen nicht anheben**, auch nicht „nur einmal".

---

## Ergänzung, wenn eine Fortschrittsseite gewünscht ist

Die letzte Runde führte eine veröffentlichte Seite mit je Baustein: aktuelle
Aufnahme, Bewertung, Urteil des Kritikers. Das hat sich gelohnt — es macht
sichtbar, was noch fällt.

Zwei Dinge dabei ehrlich halten:

- Die Vergleichsseite gegen ein kommerzielles Vorbild ist eine **schriftliche
  Beschreibung**, kein Bildschirmfoto davon. Fremde Oberflächen werden nicht
  reproduziert.
- Aufnahmen, die etwas nicht zeigen, gehören nicht als Beleg auf die Seite.
  Achtzehn als „dunkel" beschriftete Aufnahmen, die in Wahrheit hell waren,
  sind schlimmer als gar keine.
