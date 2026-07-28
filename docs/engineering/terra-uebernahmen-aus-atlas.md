# Was Terra von Atlas-3D übernehmen sollte

> **Aufbewahrt als Begründungsquelle.** Atlas-3D ist am 27.07.2026 vollständig
> entfernt worden; dieses Dokument ist der letzte Ort, an dem nachlesbar ist,
> WARUM Terras Ebenen-Hierarchie, sein Vererbungsmodell und seine
> Generatoren so aussehen, wie sie aussehen. Wer es löscht, behält die
> Entscheidungen und verliert ihre Gründe. Die Codeverweise auf
> `packages/atlas-3d` zeigen ins Leere — nachschlagbar bleiben sie über die
> Historie bis Commit `6823a134`.

Planungsstand 27.07.2026 — **nur Planung, nichts umgesetzt.** Grundlage ist die
Atlas-3D-Analyse (`packages/atlas-3d`, 86 Module; sechs Prisma-Modelle) im
Vergleich mit Terra nach Runde H.

**Bewusst ausgeklammert:** alles Planetare. Kein SDF-Globus, keine Carve-Ops als
CSG am Kugelkörper, keine Weltwurzeln, keine Orbit-Assets, kein
äquirektangulares Gitter. Terra ist ein **Karteneditor**, und das bleibt es.
Ebenso nicht übernommen wird Atlas' Tusche-Look — Terra hat eine eigene, weiter
entwickelte Bildsprache.

Sortiert nach Wirkung. Aufwand: **[K]** klein · **[M]** mittel · **[G]** groß.

---

## A — Struktur: das, was Terra grundsätzlich verändert

### A1 [G] Ebenen-Hierarchie mit Drill-Down
**Atlas kann es, Terra nicht — und es ist der größte Einzelgewinn.** In Atlas
umreißt man eine Region auf der Karte und öffnet sie als **eigene, feinere
Karte**: Kontinent → Landschaft → Stadt. Der Umriss wird zur *gesperrten
Silhouette* der Kindebene, das Kind kennt seine Herkunft, ein Ebenenbaum
navigiert dazwischen.

Für Terra heißt das: aus „eine Karte pro Datei" wird „ein Atlas". Der
Regionsumriss ist bereits vorhanden (Flächen-Werkzeug), die Silhouette wäre eine
Maske analog zur Bruchmaske, und `hydrate`/`serializeElements` sind generisch
genug, um mehrere Karten in einer Datei zu tragen.

Offene Fragen: Wie erbt das Kind Höhen (Ausschnitt hochskalieren vs. neu
erzeugen)? Was passiert bei Änderungen an der Elternebene? Atlas löst das mit
„Seed + Silhouette, Rest neu ableiten" — für Terra plausibel, weil dort ohnehin
alles aus Punkten, Parametern und Seed entsteht.

### A2 [M] Vererbung mit sichtbarer Herkunft
Atlas löst Einstellungen von der Wurzel zum Blatt auf und zeigt an jedem Feld,
woher der Wert kommt („⤓ geerbt von *Nordmark*") bzw. dass er überschrieben ist,
mit einem Klick zurück auf „erben". Das ist erstklassige Bedienung und
unabhängig von der Hierarchie nützlich: Terra könnte damit Biom, Tageszeit,
Wetter, Farbskript und Palettenbindung sauber zwischen Karte und Region
staffeln.

---

## B — Terrain-Werkzeuge, die Terra fehlen

### B1 [M] Eingriffe-Stack (nicht-destruktives Terrain)
Atlas führt Terrain-Eingriffe als **geordnete Liste** — jeder Eintrag lässt sich
einzeln ausblenden oder entfernen, das Feld wird daraus neu gerechnet. Terra hat
stattdessen ein Höhenfeld plus Delta gegen den Seed: Ein Pinselstrich von vor
zwanzig Schritten ist nicht mehr adressierbar, nur linear rückgängig zu machen.

Für Terra: Pinselstriche als Ops speichern (Position, Radius, Stärke, Modus,
Zeitpunkt) und das Delta daraus ableiten, statt Werte direkt zu schreiben.
Nebeneffekt: Das Speicherformat würde noch kleiner, und „diesen Berg wieder
weg" wäre ein Klick statt zwanzig Undos.

### B2 [M] Höhen-Layer-Stack
Benannte, sortier- und ausblendbare Höhenebenen mit aktivem Ziel-Layer (Muster:
Unreal Landscape Edit Layers). Grundgebirge, Täler, Feinschliff getrennt
bearbeitbar. Passt technisch gut zu B1 und ist unabhängig davon nützlich.

### B3 [M] Erosion
Atlas hat thermische Erosion (talus-limitierter Transport) und einen
Incise-Pass über die Flow-Accumulation — als Pinsel **und** als globaler
Durchlauf mit „Feature-Größe"-Regler. Terra hat nichts dergleichen; sein Gelände
ist glattes fraktales Rauschen. Erosion ist der eine Schritt, der prozedurales
Terrain glaubwürdig macht: Grate werden scharf, Hänge bekommen Rinnen, Täler
füllen sich mit Sediment.

Terras Weltgenerator würde davon am meisten profitieren — er leitet Flüsse schon
aus dem Gefälle ab, aber das Gefälle selbst ist noch zu weich.

### B4 [K] Terrain-Stempel
Krater, Gebirge, Dünen als wiederverwendbare Pinselprofile, dazu beliebige
Graustufen-PNGs als eigene Stempel. Terra kann heute nur ein PNG als *ganzes*
Höhenfeld importieren — ein Stempel ist etwas anderes: lokal, wiederholbar,
drehbar.

### B5 [K] Landmassen-Vorlagen
Kontinent / Archipel / Hochinsel als Ausgangspunkt vor dem Formen. Terra hat
Biom-Höhenprofile, die etwas Ähnliches leisten, aber keine wählbare Grundform.
Billig umzusetzen, spart beim Kartenanfang viel Zeit.

---

## C — Karten-Semantik: was eine Karte zur Karte macht

### C1 [G] Biome als Flächen statt als Karteneigenschaft
**Die auffälligste konzeptionelle Lücke.** In Terra hat eine Karte *ein* Biom.
Atlas malt Biome als stufenlosen Splat und kann sie zusätzlich aus Höhe und
Klima **ableiten** (Whittaker-Kurzschluss), danach jederzeit übermalen.

Für Terra steht das als H2b schon in der Roadmap (Stufe 1: Flächen-Element,
Stufe 2: Pinsel) — Atlas zeigt, dass die Ableitung dazugehört: Der Nutzer malt
nicht 25 Biome von Hand, er lässt vorschlagen und korrigiert. Terras
Biom-Registry ist mit Paletten, Vegetationstabellen, Schnee und Partikeln
deutlich tiefer als Atlas' sechs Farben — die Kombination wäre stark.

### C2 [M] Territorien und Zonen
Politische Flächen mit Name, Farbe und Umriss — in Atlas ein eigener Featuretyp.
Terra kennt nur Marker (Punkte). Für Kampagnenkarten sind Gebiete („Herzogtum
Aschen", „Gefahrenzone") mindestens so wichtig wie Punkte.

### C3 [M] Beschriftungen im Bild statt im Browser
Terras Marker-Labels sind ein HTML-Overlay — sie erscheinen **nicht im
PNG-Export**. Atlas zeichnet Labels als Sprites mit Papier-Kontur in die Szene,
also auch ins exportierte Bild. Für ein Werkzeug, dessen Ergebnis geteilt wird,
ist das ein echter Mangel bei Terra.

Ausbaustufe (steht in Atlas' Roadmap, ist dort aber *nicht* umgesetzt):
**gebogene Beschriftungen**, die Küsten und Flüssen folgen — das ist der
Unterschied zwischen „Text auf Karte" und „Kartenbeschriftung".

### C4 [K] Höhenlinien
Marching Squares über das Höhenfeld, als schaltbare Ansicht. Terra hat das Feld,
aber keine Darstellung dafür. Billig und sofort „kartig".

### C5 [K] Thematische Ansichten
Atlas kann zwischen Karte / Klima / Höhe umschalten (temporär abgeleiteter
Splat, das Original bleibt unberührt). Für Terra naheliegend zu erweitern:
Relief, politisch (Territorien), Bevölkerung, Arbor-Nähe.

### C6 [K] Messwerkzeug
Entfernung in *Wegstunden* statt in Einheiten — Atlas rechnet 24 pro
Karteneinheit. Für Spielleiter die praktischste Zahl überhaupt, und Terra hat
mit der A*-Wegsuche sogar die bessere Grundlage: echte Reisezeit statt Luftlinie.

---

## D — Generatoren

### D1 [M] Namens-Generator
Vier Kulturen (nordisch, romanisch, wüsten, sylvan) als Silbenkompositor,
deterministisch aus (Kultur, Seed, Index). Terra kann heute **gar keine Namen** —
jeder Marker, jede Siedlung braucht Handarbeit. Klein, sofort spürbar.

### D2 [M] Siedlungen: erst festlegen, dann generieren
Atlas lässt Pflichtmerkmale wählen (Mauern + Türme, Zitadelle) und generiert
danach. Terras `genViertel` würfelt alles auf einmal. Der Unterschied ist
Kontrolle: „Diese Stadt hat eine Mauer und einen Tempel" statt „nochmal würfeln,
bis es passt".

### D3 [G] Wave Function Collapse für Ortslayouts
Atlas' `wfc-settlement.ts` ist ein echtes WFC auf irregulärem Ringraster mit
AC-3-Propagation und deterministischem Neustart bei Widerspruch. Terras
Gassennetze sind regelmäßiger (Raster, gebogen, Zellen, Ring). WFC gäbe
gewachsene, unregelmäßige Orte — der Townscaper-Effekt. Großer Aufwand, großer
Charakter-Gewinn.

### D4 [K] Chronik
Deterministische Lore-Einträge (Jahr + Ereignis) aus Seed und Akteuren. Reine
Zugabe, aber sie macht aus einer Karte einen Ort mit Geschichte.

---

## E — Verlässlichkeit und Bedienung

### E1 [G] Testabdeckung
Atlas hat ~150 Unit-Tests im Paket, 34 in der Domänenlogik, 13 im Service und
5 e2e-Tests. **Terra hat keinen einzigen automatisierten Test** — nur die
einmalige Playwright-Sichtprüfung. Für ein Projekt mit 29 Modulen,
Determinismus-Zusage und Formatkompatibilität über vier Versionen ist das die
größte Risikolücke. Mindestens: Determinismus (gleiche Seed → gleicher Hash),
Formatkompatibilität (v1–v4 laden), Generator-Invarianten.

### E2 [K] Kamera-Lesezeichen
Benannte Blickpunkte, per Klick angeflogen (700-ms-Tween). Terra hat den
Aufnahme-Modus, aber keine gespeicherten Ansichten. Auf großen Karten fehlt das
sofort.

### E3 [M] Nur-Lese-Ansicht
Atlas liefert denselben Renderer im Portal ohne Werkzeuge aus. Für Terra der
direkte Vorläufer der Spielersicht — und unabhängig von der UWE-Frage nützlich
(„so sieht die Karte aus, ohne dass ich sie versehentlich ändere").

### E4 [M] KI-Beschreibung
Atlas beschreibt eine Region über Brain, ausdrücklich als Vorschlag, nie
automatisch im Kanon. Für Terra erst nach der UWE-Einbindung sinnvoll, aber das
Muster (read-only Ergebnis, Provider wählbar, explizit „kein Kanon") ist
übernehmenswert.

---

## Was ich bewusst NICHT übernehmen würde

| Aus Atlas | Warum nicht |
|---|---|
| SDF-Globus, Surface Nets, Carve-Ops, Weltwurzeln | Planetar — ausdrücklich außerhalb des Auftrags |
| Tusche-/Inverted-Hull-Look | Terra hat eine eigene, weiter entwickelte Bildsprache |
| Orbit-Assets (Mond, Asteroid) | An den Globus gebunden |
| Atlas' Wetter-Partikel (420 CPU-Points) | Terras Instanz-System ist die bessere Lösung |
| Atlas' Biom-Splat mit 6 Farben | Terras Registry mit 25 Biomen ist tiefer |
| Ein zweiter Undo-Stack | Terras Copy-on-Write-Undo ist bereits effizienter |

---

## Reihenfolge, wenn es losgeht

1. **C1 Biom-Flächen + Ableitung** — größter sichtbarer Gewinn, steht ohnehin
   als H2b in der Roadmap
2. **B3 Erosion** — macht das Gelände glaubwürdig, hebt auch den Weltgenerator
3. **C3 Labels im Bild** + **C4 Höhenlinien** + **C6 Messen** — die drei
   billigsten Schritte Richtung „echte Karte"
4. **D1 Namen** — klein, sofort spürbar
5. **B1 Eingriffe-Stack** + **B2 Höhen-Layer** — zusammen als ein Umbau
6. **A1 Ebenen-Hierarchie** — der große Wurf, danach ist Terra ein Atlas
7. **E1 Tests** — sollte eigentlich vor 5 und 6 kommen, spätestens aber dann

Nicht in dieser Liste, aber im Hinterkopf: A1 und E3 sind zugleich die
Vorarbeiten für die UWE-Einbindung.
