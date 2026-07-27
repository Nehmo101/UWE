# Terra — Runde J: UWE-Übernahme, Namen, KI-Vorgenerierung

Planungsstand 27.07.2026. **Nur Planung, nichts umgesetzt.**

Diese Runde beantwortet die Frage, wie Terra in UWE landet. Entscheidung des
Eigentümers: **Terra ersetzt Atlas-3D vollständig.** Terra übernimmt dessen
Pfade, Atlas wird danach restlos entfernt — kein Verweis, keine Route, keine
Tabelle.

Voraussetzung ist Runde I (`terra-runde-i-plan.md`), besonders I1
(Ebenen-Hierarchie) und I5 (Tests) — ohne Ebenen fehlt Terra das Gegenstück zu
Atlas' Node-Baum, ohne Tests wäre die Übernahme fahrlässig.

---

# J1 — Terra unter den Atlas-Pfaden

## Ziel

Dieselben Adressen, dahinter Terra:

| Pfad | heute | danach |
|---|---|---|
| `/worlds/[worldSlug]/atlas3d` | Atlas-Bootstrap | Terra-Kartenliste bzw. Wurzelkarte |
| `/worlds/[worldSlug]/atlas3d/[nodeId]` | Atlas-Editor | Terra-Editor für diese Karte |
| `/auth/worlds/[worldSlug]/atlas3d` (Portal) | Atlas-Viewer | Terra-Ansicht (nur lesen) |
| `/auth/worlds/[worldSlug]/atlas3d/[nodeId]` | Atlas-Viewer | Terra-Ansicht dieser Karte |

**Namensfrage, bewusst offen gehalten:** Die Segmente heißen weiterhin
`atlas3d`, damit vorhandene Links, Lesezeichen und Wiki-Verweise gültig bleiben.
Ob später auf `/karten` umbenannt wird, ist eine getrennte Entscheidung — sie
bräuchte dann Weiterleitungen von `atlas3d`, genau wie die alten `/atlas`-Pfade
heute auf `atlas3d` zeigen. Die Beschriftung in der Navigation wird dagegen
sofort auf **„Karten"** geändert.

## Was Terra dafür braucht

Terra ist heute eine statische Einzelseite mit ES-Modulen und Import-Map, ohne
Build-Schritt. Das ist eine Stärke (kein Bundler, sofort startbar) und soll nicht
geopfert werden. Zwei Wege stehen zur Wahl:

**Weg A — Terra als eingebettete Seite (empfohlen).** Terra bleibt genau wie es
ist und wird unter `apps/studio/public/terra/` ausgeliefert; die Route rendert
eine dünne React-Seite, die Terra in einem `iframe` einbettet und über
`postMessage` mit ihm spricht (Karte laden, Karte speichern, Titel, Speicherzustand).
- **Dafür:** Terra bleibt unabhängig testbar und lokal startbar, kein Bundler,
  kein Three-Versionskonflikt (Terra 0.185.1 vs. Atlas 0.178.0 — nach dem Ausbau
  von Atlas ist das egal, aber Studio bringt eigene Abhängigkeiten mit),
  Ladezeit der Studio-Seiten unverändert.
- **Dagegen:** Kommunikation über eine schmale Brücke; Panels von Terra können
  keine Studio-Komponenten nutzen; CSP muss den Frame erlauben (die Header dafür
  existierten für den alten Atlas bereits, `packages/auth/security-headers.ts`).

**Weg B — Terra als Paket.** `packages/terra` mit `three` aus dem Workspace, die
Module direkt in die Studio-App importiert.
- **Dafür:** eine Anwendung, gemeinsame UI, kein `postMessage`.
- **Dagegen:** Terra verliert die Eigenständigkeit (kein Öffnen per Doppelklick
  mehr), die 29 Module müssen durch den Next-Build, und die Import-Map fällt weg.

**Empfehlung: Weg A**, mit einer klaren Brücke. Terras Kern bleibt damit das,
was ihn schnell gemacht hat.

## Datenhaltung

Terras Kartenbaum (Runde I) passt fast eins zu eins auf ein relationales Modell.
Neue Prisma-Modelle (Namen bewusst neu, nicht Atlas' Namen weiterverwenden):

```
TerraAtlas    id, worldId(unique), titel, seed, erstellt, geaendert
TerraKarte    id, atlasId, elternId?, titel, slug, einheitMeter,
              kartenGroesse, seed, biom, ausschnitt Json?, hoehenQuelle,
              sortierung, seiteId?  (→ Wiki-Page)
TerraStand    karteId(unique), daten Json, version Int, geaendert
              // der komplette Kartenstand als v5-JSON, wie ihn Terra speichert
TerraFassung  id, karteId, daten Json, erzeugt, notiz?
              // Versionshistorie — Atlas hatte keine, das war eine echte Lücke
```

Bewusste Unterschiede zu Atlas:
- **`TerraStand` als ein Blob** statt zerlegter Elemente/Objekte/Features.
  Terras Format ist bereits kompakt (Höhen als Delta, Elemente als Punkte +
  Parameter + Seed), und der Editor lädt und schreibt ohnehin die ganze Karte.
  Ein relationales Zerlegen brächte nichts außer Abgleichaufwand.
- **`TerraFassung`**: Atlas hat keine serverseitige Historie — ein
  „Zurücksetzen" ist dort unwiderruflich. Terra bekommt eine, mit Deckel
  (z. B. 20 Fassungen je Karte, älteste fallen raus).
- **Sichtbarkeit je Karte**: neues Feld `sichtbarkeit` (`dm` | `spieler`).
  Atlas hatte das nicht (alles war spielersichtbar), und für Kampagnenkarten ist
  „diese Region kennen die Spieler noch nicht" die häufigste Anforderung.

## Rechte und Mandanten

Muster von Atlas übernehmen, aber neu geschrieben: dreifacher Guard je Server
Action — CSRF/Origin, Rolle (owner/admin/dm), Welt-Zugehörigkeit der Karte.
Portal liest über den Zugriffskontext der Welt und **filtert auf
`sichtbarkeit: "spieler"`**.

Die Contract-Klassifikation der neuen Modelle: `dnd_world` mit
`player_visible` für Karten mit Spielersichtbarkeit — aber weil es jetzt beide
Fälle gibt, braucht es die Trennung auf Zeilenebene, nicht auf Modellebene. Das
muss mit `packages/product-contracts` abgestimmt werden (dort ist die Klasse
heute je Modell fest).

## Speichern

- Autosave debounced (Terra hat den Ringpuffer im LocalStorage bereits; er
  bleibt als Absturzschutz und wird um einen Serveraufruf ergänzt).
- **Mit `beforeunload`-Flush** — der Mangel, den Atlas hat (Timer wird beim
  Verlassen abgebrochen statt ausgeführt).
- **Konflikterkennung** über `version` im `TerraStand`: Wer mit veralteter
  Version schreibt, bekommt eine Rückfrage statt eines stillen Überschreibens.
  Auch das fehlt Atlas.

## Backup und Export

Zwei Lücken, die Atlas hat und die Terra nicht wiederholen soll:
- **Backup**: `packages/backup` kennt Atlas nicht — `backup:create` sichert
  Welten heute ohne ihre Karten. Terra wird von Anfang an aufgenommen.
- **Static Export**: `packages/static-export` ebenfalls. Terra-Karten sollen als
  statische Ansicht exportierbar sein (das kann Terra ohnehin schon: PNG plus
  die eigenständige HTML-Fassung).

## Aufwand
**[G]** — Route, Brücke, Modelle, Actions, Rechte, Backup, Export.

---

# J2 — Atlas restlos entfernen

Nach der Übernahme wird Atlas **vollständig gelöscht**, nicht deaktiviert.
Gemessener Umfang im Repo (nur versionierte Dateien): **77 Dateien, 1.038
Treffer** auf `atlas3d` / `atlas-3d` / `atlas_3d`.

## Was weg muss

| Bereich | Umfang | Anmerkung |
|---|---|---|
| `packages/atlas-3d` | 86 Dateien, ~12.500 Z. | komplettes Paket, inkl. der ~900 Z. Legacy-Rendermodule |
| `packages/atlas-editor` | 10 Dateien, ~1.270 Z. | Carve-Ops, Vererbung, Command-Stack |
| `apps/studio/src/components/atlas3d` | 11 Dateien, ~2.570 Z. | UI + CSS |
| `apps/portal/src/components/atlas3d` | 3 Dateien | Viewer |
| `apps/studio/app/atlas3d-actions.ts` | 401 Z. | Server Actions |
| `packages/database/src/atlas3d-service.ts` (+ Test) | 651 Z. | Service |
| Routen Studio + Portal | 4 Seiten | plus die beiden `/atlas`-Redirects, die auf `atlas3d` zeigten |
| Navigation | 4 Stellen | `studio-navigation.ts`, `world-nav.ts`, `portal-nav.ts`, `mobile-nav.ts` |
| `packages/product-contracts` | 6 Modelleinträge | plus die Tests, die sie prüfen |
| e2e | 2 Dateien | `studio-atlas3d.spec.ts`, `portal-atlas3d.spec.ts` |
| `scripts/atlas3d-demo-seed.ts` | 99 Z. | Demo-Seed |
| Docs | 10 Dateien | u. a. `atlas3d-feature-roadmap.md`, `atlas-3d.md`, `atlas-follow-ups.md` |
| Statisches | `packages/static-export/static/atlas.html`, `docs/artifacts/atlas-3d-prototype.html` | Prototypen |
| Prisma | 6 Modelle + Enum `AtlasNodeLevel` | plus Relationsfelder in `World`, `Page`, `Asset` |
| Brain-Actions | 4 Stück | `atlas_name_regions`, `atlas_describe_region`, `atlas_fill_area`, `atlas_generate_asset_proposal` — siehe unten |

## Sonderfall Brain-Actions

Vier der zwölf Brain-Actions gehören zu Atlas. Sie **nicht einfach mitlöschen**:

- `atlas_fill_area` und `atlas_generate_asset_proposal` sind die **Vorlage** für
  Terras eigene Karten-Action (J4) — ihre Validatoren und der
  Prompt-Kontext-Generator sind das Beste, was das Repo an strukturierter
  KI-Ausgabe hat. Erst übernehmen, dann löschen.
- `atlas_name_regions` ist inhaltlich das, was J3 leisten soll — als Vorlage
  ansehen, dann durch die Terra-Fassung ersetzen.
- `atlas_describe_region` funktioniert ohnehin nicht (siehe J4, Baustelle 3) und
  kann ersatzlos weg; die Beschreibungsfunktion kommt als Terra-Action zurück.

Zu beachten: Die Action-Ids stecken in einer compilergeprüften Union über neun
Dateien — Löschen bricht die Typprüfung an allen Stellen gleichzeitig, das ist
gewollt und macht den Ausbau sicher.

## Reihenfolge (wichtig, sonst bricht es)

1. **Migration schreiben, die Daten übernimmt** — nicht löschen, sondern
   überführen: aus `Atlas3DNode` + `Atlas3DTerrain` + `Atlas3DObject` +
   `Atlas3DFeature` je eine `TerraKarte` samt `TerraStand`. Was sich nicht
   sinnvoll abbilden lässt (Carve-Ops am Globus, Weltwurzeln), wird als
   **Hinweis in der Kartennotiz** vermerkt statt still verschluckt.
   *Sollte auf die Übernahme verzichtet werden* — also alte Atlas-Welten
   verwerfen —, muss das eine ausdrückliche Entscheidung sein, keine
   Nebenwirkung. Vorher Backup ziehen.
2. **Routen umstellen** (J1), Atlas-Seiten bleiben vorerst erreichbar.
3. **Navigation umhängen**, Beschriftung auf „Karten".
4. **Atlas-Seiten entfernen**, Verweise entfernen, Tests entfernen.
5. **Pakete löschen**, `package.json`/Workspace bereinigen, `three@0.178.0`
   entfällt als Abhängigkeit.
6. **Prisma-Migration `drop_atlas3d`** — Tabellen und Enum entfernen,
   Relationsfelder aus `World`/`Page`/`Asset` streichen.
7. **Contracts und deren Tests** anpassen (die Boundary-Tests prüfen die
   Modellliste — sie schlagen sonst fehl).
8. **Dokumente entfernen oder als historisch markieren.** Empfehlung: die
   Roadmap `atlas3d-feature-roadmap.md` **behalten** und umbenennen — sie ist
   eine gute Ideensammlung aus echter Recherche und unabhängig von Atlas
   nützlich. Alles andere weg.
9. **Repo-weite Endprüfung**: `git grep -i atlas` muss leer sein (bis auf die
   bewusst behaltene Roadmap und Changelog-Einträge).

## Was dabei nicht vergessen werden darf

- **Der alte 2D-Atlas** hinterließ bereits Redirects (`/atlas` → `/atlas3d`).
  Die zeigen nach dem Ausbau ins Leere und müssen mit umgestellt werden.
- **CSP/Frame-Header** in `packages/auth/security-headers.ts` enthalten
  Atlas-Sonderregeln — bei Weg A (iframe) werden sie für Terra gebraucht, sonst
  entfallen sie.
- **Changelog**: Der Ausbau gehört dokumentiert, damit später niemand rätselt,
  wohin Atlas verschwunden ist.

## Aufwand
**[M]** — mechanisch, aber breit. Der Löschteil ist einfach; die
Datenübernahme in Schritt 1 ist die eigentliche Arbeit.

---

# J3 — Namens-Generator

Terra kann heute **gar keine Namen**. Jede Siedlung, jeder Marker, jede Region
braucht Handarbeit. Das ist bei 25 Biomen und einem Weltgenerator, der 90
Elemente auf einmal setzt, der spürbarste Bruch im Ablauf.

## Entwurf (Terra-eigen, nicht Atlas' Silbenkompositor)

Atlas hat vier Kulturen mit Silbenlisten. Für Terra plane ich ein Verfahren, das
zum Setting passt und mehr Struktur trägt:

**1. Namen entstehen aus Bestandteilen mit Bedeutung.**
Ein Ortsname ist typischerweise *Bestimmungswort + Grundwort*: „Aschen**furt**",
„Nord**mark**", „Stein**bach**". Terra bekommt dafür je Sprachfamilie zwei
Listen — Bestimmungswörter (Farbe, Material, Himmelsrichtung, Tier, Person) und
Grundwörter (Furt, Bach, Mark, Feste, Halde, Wehr, Steg, Grund …). Das erzeugt
Namen, die **lesbar motiviert** sind statt nur klangvoll.

**2. Der Ort bestimmt den Namen mit.**
Das ist der eigentliche Terra-Dreh: Der Generator kennt die Karte. Eine Siedlung
an einer Flussquerung bekommt bevorzugt „-furt", eine am Hafen „-hafen" oder
„-bucht", eine auf einem Pass „-pass" oder „-scharte", eine im Moor „-bruch",
eine an einer Bruchkante „-riss" oder „-abgrund". Die Zutaten dafür liegen alle
vor: Wassernähe, Hangneigung, Biom, Nähe zu Fluss/Straße/Bruchkante/Arbor.
Ein Name, der zur Lage passt, ist mehr wert als tausend zufällige.

**3. Sprachfamilien statt „Kulturen".**
Fünf Familien, die zu den Baustilen passen (Dorf, Klassisch, Zwergisch, Elfisch,
Arbor-Kult) plus eine neutrale. Jede mit eigener Lautstruktur (welche
Konsonantenverbindungen erlaubt sind, welche Endungen, Wortlänge).

**4. Region prägt.**
Karten (und in der Hierarchie: Elternkarten) tragen eine Sprachfamilie; Orte
darin erben sie, mit einer kleinen Wahrscheinlichkeit für Fremdnamen — so
entstehen Sprachgrenzen statt Einheitsbrei.

**5. Deterministisch, wie alles.**
Der Name hängt an `(Kartenseed, Elementseed, Rolle)` — dieselbe Karte hat immer
dieselben Namen, und „Neu würfeln" auf einem Element ändert nur dessen Namen.

**6. Sammelnamen.**
Nicht nur Orte: Flüsse („Die Trübe", „Alte Ader"), Gebirge, Wälder, Regionen,
Gasthäuser, Arbor-Ranken (die brauchen eigene, altertümlichere Namen).

## Anbindung

- Panel-Knopf „🎲" neben jedem Textfeld (Marker, Beschriftung, Siedlung).
- Der **Weltgenerator** benennt alles, was er setzt — das ist der Unterschied
  zwischen „90 namenlose Elemente" und „einer Karte".
- Eine **Namensliste** im Panel: alle vergebenen Namen der Karte, umbenennbar,
  Dubletten markiert.

## Aufwand
**[M]** — Wortlisten und Lautregeln sind der größere Teil, die Anbindung ist klein.

---

# J4 — KI-Vorgenerierung per Prompt

## Die Frage

„Küstenregion mit drei Fischerdörfern, Gebirge im Norden, ein Fluss von Ost nach
West" → Terra baut daraus eine Karte.

## Die Antwort in einem Satz

Ja — aber nur in der richtigen Arbeitsteilung: **Die KI liefert Parameter, nicht
Geometrie.** Der vorhandene deterministische Weltgenerator baut daraus die Karte.

## Warum nicht mehr

Terra ist auf Determinismus gebaut: gleiche Seed, gleiche Karte, kein
`Math.random`, alles aus Punkten, Parametern und Seed. Eine KI, die Koordinaten
ausgibt, bricht das an drei Stellen:

1. **Halluzinierte Geometrie.** Ein Sprachmodell erfindet Punktlisten, die weder
   dem Höhenfeld folgen noch die Platzierungsregeln kennen — Dörfer im Wasser,
   Straßen über 40°-Hänge, Flüsse bergauf.
2. **Kein Determinismus.** Zweimal derselbe Prompt ergibt zwei Karten. Terras
   Speicherformat lebt davon, dass aus Seed und Parametern dasselbe entsteht —
   eine KI-Ausgabe müsste dann vollständig gespeichert werden, was das
   Delta-Format entwertet.
3. **Größe.** Eine 1024er Karte hat schnell 90 Elemente mit hunderten Punkten;
   das als JSON aus einem Modell zu ziehen ist teuer, langsam und fehleranfällig.

## Der Zuschnitt, der funktioniert

Die KI übersetzt **Sprache in Generator-Parameter**:

```
Prompt: "Raue Küstenregion, drei Fischerdörfer, Gebirge im Norden,
         Fluss von Ost nach West, spätherbstliche Stimmung"

→ { biom: "klippenmeer",
    kartenGroesse: 512,
    einheitMeter: 250,
    klimaAchse: { richtung: 15, staerke: 0.6 },
    hoehenBetonung: { norden: 0.8 },        // Gebirge im Norden
    fluesse: { anzahl: 1, hauptrichtung: "ost-west" },
    siedlungen: { anzahl: 3, art: "hafen", stil: "dorf" },
    waldanteil: 0.35,
    ranken: 2,
    tageszeit: "abend", wetter: "bewoelkt",
    sprachfamilie: "nordisch",
    namen: { region: "Die Graue Küste",
             orte: ["Möwenfurt", "Salzhafen", "Klippenau"],
             fluss: "Die Trübe" } }
```

Daraus baut `erzeugeWelt(seed, opt)` — der Generator, den Terra seit Runde H hat
— eine vollständige, regelkonforme, deterministische Karte. Die KI steuert das
**Was**, der Generator garantiert das **Wie**.

Das hat drei angenehme Eigenschaften:
- **Determinismus bleibt.** Gespeichert wird der Parametersatz plus Seed; die
  Karte ist reproduzierbar, das Format bleibt klein.
- **Regeln bleiben.** Kein Dorf im Wasser, weil die KI gar keine Koordinaten
  vergibt.
- **Nachbearbeitbar.** Das Ergebnis besteht aus normalen Elementen — verschieben,
  löschen, neu würfeln funktioniert wie immer.

## Wo die KI mehr darf

Zwei Bereiche, in denen freier Text genau richtig ist und kein Determinismus
verletzt wird:

- **Namen** (siehe J3): Die KI kann die Vorschläge des Namensgenerators
  ersetzen oder anreichern — Namen sind Text, kein Regelwerk.
- **Beschreibungen**: Ein Absatz zu einer Region, einem Ort, einer Ranke — als
  Vorschlag, ausdrücklich nicht als Kanon (das Muster hat Atlas richtig gelöst
  und ist übernehmenswert). Landet als Kartennotiz oder als Entwurf einer
  Wiki-Seite, die der Spielleiter freigibt.

## Ergebnis der Brain-Prüfung (27.07.2026)

Die Untersuchung ist abgeschlossen. Kurzfassung: **Der geplante Zuschnitt ist im
Repo bereits etablierte Praxis** — es gibt aber drei Baustellen, die vorher
erledigt sein müssen.

### Was Brain ist

`packages/ai-brain` (LLM-Router, Provider, Actions, Kontextbau, Proposals) hinter
der Studio-Route `/api/brain/run`. **Nicht zu verwechseln mit `apps/brain`** —
das ist die private Life-Admin-App und hat damit nichts zu tun.

Ein Aufruf legt immer einen **Job** an (DB-persistiert, in-process ausgeführt,
mit Fortschritt, Abbruch, Wiederholung). Für eine Kartengenerierung, die ein paar
Sekunden braucht, ist das genau die richtige Grundlage — der Client pollt statt
zu warten.

### Der Präzedenzfall

Von den zwölf vorhandenen Actions sind zwei genau unser Muster:

- **`atlas_fill_area`** — liefert ein Streu-Rezept als **validiertes JSON**, mit
  dem Kommentar im Code: *„The model may suggest scatter parameters, but UWE owns
  geometry, visibility, palette resolution, object creation and final
  persistence."* Das Schema enthält `seed` und `density`; ein deterministischer
  Konsument baut daraus per `mulberry32(seed)` reproduzierbar die Objekte.
- **`atlas_generate_asset_proposal`** — validierbares Proposal, nie Code.

Das ist wörtlich der Zuschnitt aus dem Abschnitt oben, nur eine Ebene kleiner
(Fläche statt Welt). Die Validatoren (`plot-fill-proposal.ts`) lehnen unbekannte
Felder, Typfehler, Bereichsverletzungen **und jeden ausführbaren Code** ab und
liefern zugleich den erlaubten Wertebereich in den Prompt. Als Vorlage für
`terra_world_draft` ist das nahezu fertig.

### Baustelle 1: Es gibt keinen JSON-Zwang

**Der wichtigste Befund.** Die Provider senden heute **kein** `response_format`,
kein `json_schema`, keine Tool-Calls, und für Ollama kein `format: "json"`. Auch
**kein `seed`**, und die Temperatur ist fest auf 0.7. „JSON" ist heute reine
Prompt-Disziplin plus nachträgliches Ausschneiden zwischen erster `{` und letzter
`}` — ohne Wiederholung bei Fehlschlag (das Ergebnis landet dann als
`validation: "invalid"` im Proposal).

Mit einem kleinen lokalen Modell und einem komplexen Schema ist die Trefferquote
damit deutlich unter 100 %. Nötig wäre:
1. `GenerateTextOptions` um `responseFormat`, `temperature` und `seed` erweitern
2. Durchreichen in den Providern (OpenAI/OpenRouter `response_format`, Anthropic
   über Tool-Use mit `input_schema`, Ollama `format: <schema>` + `options.seed`
   + `temperature: 0`)
3. Router und Connector-Queue müssen die Felder mitführen
4. **Reparaturschleife**: bei Validierungsfehler ein zweiter Durchgang mit den
   Fehlern als Hinweis (das Muster gibt es beim Theme-Generator schon)

Das ist der eigentliche Hebel für Verlässlichkeit — und es nützt allen Actions,
nicht nur unserer.

### Baustelle 2: Ollama läuft hier, aber ohne Modelle

`ollama.exe` läuft (Version 0.30.11), `/api/tags` antwortet aber mit **HTTP 500**:
Das Modellverzeichnis zeigt auf ein Laufwerk `E:`, das es nicht gibt. Damit ist
**kein einziges lokales Modell verfügbar**. Da in der `.env` zugleich
`UWE_AI_CLOUD_FALLBACK=false` steht und keine Cloud-Schlüssel hinterlegt sind,
würde jede Brain-Action derzeit mit „Lokale RTX-Inference ist nicht bereit"
abbrechen. **Das muss vor jedem Experiment repariert werden.**

### Baustelle 3: Zwei Fehler im vorhandenen Atlas-Aufruf

Das Beschreiben-Panel von Atlas sendet keinen `pageSlug` — das Body-Schema
verlangt ihn aber (also 400), und sein `sync: true` wird von der Validierung
stillschweigend entfernt, sodass der synchrone Zweig über HTTP gar nicht
erreichbar ist. Mit anderen Worten: **`atlas_describe_region` funktioniert
vermutlich seit jeher nicht**, und es ist niemandem aufgefallen — ein guter
Hinweis darauf, wie wenig die Funktion genutzt wurde.

Für uns heißt das: `pageSlug` optional machen (die Action kann sich ihre
Ankerseite selbst suchen) und den Job-Polling-Weg nutzen statt `sync`.

### Grenzen, mit denen zu rechnen ist

| Grenze | Wert |
|---|---|
| Provider-Timeout | 120 s |
| Kontext | 24.000 Zeichen (harter Abbruch) |
| Nutzer-Prompt | 10.000 Zeichen |
| Ausgabe | **2.048 Token voreingestellt**, Deckel 8.192 |
| Rate-Limit | 30 Anfragen / 60 s je Nutzer |
| Rollen | nur owner/admin/dm |

Der Entwurf oben (Parameter + Namen, keine Punktlisten) passt bequem in ~800
Token. **Sobald Polygone oder Pfade im JSON stünden, reißt das Limit** — und
abgeschnittenes JSON ist unparsebar. Ein weiteres Argument für die
Arbeitsteilung.

### Zwei Fallen für den Determinismus

1. **Der Prompt-Cache täuscht Reproduzierbarkeit vor.** Identische Anfragen
   liefern identische Antworten — bis der Prozess neu startet oder 128 Einträge
   überschritten sind. Darauf darf man nichts stützen.
2. **Automatische Routenwahl kann das Modell wechseln** (je nach RTX-Bereitschaft).

Beides ist unkritisch, **solange die KI-Antwort ein einmalig erzeugtes,
gespeichertes Artefakt ist**: Parametersatz und Namen werden in der Karte
abgelegt, ab da ist alles deterministisch. Nicht: bei jedem Öffnen neu fragen.

### Der eine Punkt, der Terra-Arbeit ist

„Gebirge im Norden" lässt sich heute nicht erfüllen: `genBase` erzeugt sein
Höhenfeld unabhängig vom Wunsch aus zwei Rauschoktaven. Zwei Wege:
- **Bias-Terme in `genBase`** (Gebirgsachse, Küstenrichtung, Rauheit) — sauber,
  aber ein Eingriff in den Kern, der die Byteidentität bestehender Karten
  berühren würde (also hinter Default-Werten, wie in Runde H gehandhabt).
- **Seed-Suche**: N Seeds deterministisch durchprobieren und den nehmen, der dem
  Wunsch am nächsten kommt. Billig umzusetzen, kostet Rechenzeit, bleibt
  vollständig deterministisch. **Für eine erste Fassung der bessere Weg.**

### Umsetzungsschritte (aktualisiert)

1. Ollama-Modellpfad reparieren — sonst läuft nichts
2. `pageSlug` optional machen, Job-Polling statt `sync`
3. `terra-welt-entwurf.ts`: Validator + Prompt-Kontext-Generator nach dem Vorbild
   von `plot-fill-proposal.ts`; der Wertebereich kommt direkt aus Terras
   `PARAMS`-Schema, ist also maschinell ableitbar
4. Neuer Task-Typ + Action + Prompt (neun Dateien, compilergeprüft)
5. JSON-Zwang und Reparaturschleife in Provider und Router
6. Seed-Suche für `terrainBias` in Terra
7. Bedienung: Prompt-Feld, Parametervorschau, erzeugen

## Bedienung

Knopf **„Karte beschreiben"** neben „Welt würfeln": Textfeld, optional
Kartengröße und Seed vorgeben, Vorschau der abgeleiteten Parameter (sichtbar und
editierbar, bevor gebaut wird), dann erzeugen. Der Zwischenschritt ist wichtig —
so sieht man, was die KI verstanden hat, und kann korrigieren, statt dreimal neu
zu prompten.

## Aufwand
**[M]** für Action, Validierung und Anbindung; **[K]** für die Bedienung. Hängt
davon ab, was die Brain-Untersuchung ergibt.

---

# Reihenfolge Runde J

1. **J3 Namen** — unabhängig von allem, sofort nützlich, und Voraussetzung
   dafür, dass J4 sinnvolle Vorschläge liefern kann
2. **J4 KI-Vorgenerierung** — sobald die Brain-Prüfung vorliegt
3. **J1 Übernahme der Pfade** — braucht Runde I (Ebenen) als Grundlage
4. **J2 Atlas entfernen** — erst wenn J1 steht und die Datenübernahme geprüft ist

Zwischen 3 und 4 sollte eine Weile liegen, in der beides erreichbar ist — nicht
als Dauerzustand, aber lange genug, um im echten Betrieb zu merken, was fehlt.
