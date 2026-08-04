# Dokument-Import & Session-Runner

Stand: 2026-08-02.

Zwei Hälften desselben Problems: **wie kommen fertige Texte nach UWE** — und **wie
benutzt man sie am Spieltisch, ohne beim Nachschlagen die Stelle zu verlieren**.

---

## 1. Was für Material es gibt

| Sorte | Beispiel | Weg |
|---|---|---|
| Wiki-Seiten im Bulk | 200 NSC-Dateien aus dem Vault | Import-Zentrale → Welt → **Wiki-Seiten** |
| Kampagnenbuch, Dungeon, Weltkanon | ein langes Markdown | Import-Zentrale → Welt → **Kampagne / Dungeon / Buch** |
| Fremdes Kampagnenbuch | gekaufte PDF | PDF → Kampagne in eine **Werkstatt-Welt**, dann übernehmen |

Beides — Bulk-Wiki und Dokument — geht auch ohne Browser: das **Command Center** hat
dafür den Reiter *Import*. Dort genügt ein Pfad auf dem Host statt eines Uploads; die
Ops-Brücke ruft dieselbe Maschinerie über `ops-cli.ts` direkt gegen die Datenbank auf
(Aktionen `doc-import-targets`, `doc-import-preview`, `doc-import-execute`) und legt dabei
denselben Rückbau-Eintrag an wie das Studio — ein Lauf, der fünfzig Seiten erzeugt, muss
sich mit einem Griff zurücknehmen lassen. Siehe [command-center.md](../command-center.md).

## 2. Der Frontmatter-Dialekt

`@uwe/doc-import` liest deutsche Schlüssel. Englische bleiben gültig.

```yaml
---
titel: Pellar Hopsenried
typ: nsc                       # → PageType npc (über resolvePageTypeLabel)
status: kanon                  # → CanonicalStatus canon
welt: Terra                    # nur Abgleich; warnt bei Abweichung
kampagnen: [Turm, Himmelsrouten]
tags: [nsc, rolle/buergermeister]
siehe_auch: [ferlor, xarza]    # → PageLink „related"
quelle: [Terra_Weltkanon §Teil X]
stand: 37.03.1174
---
```

Listen gehen inline (`[a, b]`) **und** mehrzeilig (`- a`). Unbekannte Schlüssel
(`haelfte`, `spezies`, `gesinnung`, …) werden **nicht verworfen**: sie landen in den
Block-Metadaten und in einer Vorschau-Notiz.

**Mehrfach-Kampagnen:** `Page.campaignId` ist ein einzelner Fremdschlüssel. Die erste
Kampagne, die es in der Welt gibt, gewinnt; alle werden zusätzlich als Tag
`kampagne/<slug>` gesetzt, damit Filter und Wissensgraph die Mehrfachzuordnung sehen.

## 3. Markdown → HTML beim Import

`renderContentHtml` (`page-service.ts`) kann von Markdown nur Überschriften, Listen und
Absätze — **keine Tabellen, kein Fett, keine Blockzitate**. Genau daraus besteht dieses
Material. Deshalb wird **einmal beim Import** über `marked` konvertiert; der HTML-Pfad in
`renderContentHtml` (`looksLikeHtml` → `renderRichHtml` → `sanitizeWikiHtml`) war dafür
bereits vorgesehen und löst die `[[Wikilinks]]` an ihren Offsets im HTML auf.

`[[…]]` bleibt bewusst **Text**: die Auflösung passiert bei jedem Seitenaufruf gegen den
Welt-Index, und nur deshalb heilt ein heute toter Link von selbst, sobald das Ziel entsteht.
Zu `PageLink`-Zeilen wird ausschließlich, was jemand ausdrücklich als `siehe_auch`
hingeschrieben hat.

## 4. Dokument → Seitenbaum: nicht eine Seite pro Überschrift

Die erste Fassung hatte einen Regler „Bis Überschriftenebene 1–6 aufteilen". Der ist weg,
weil er die falsche Frage stellte. „Wie tief?" beantwortet niemand sinnvoll: Ein
Kampagnenbuch mit `maxDepth: 3` zerfiel in 176 Fragmente, von denen 140 aus zwei Sätzen
bestanden — und die Ebenen eines Dungeons landeten trotzdem unter der Gliederungsklammer
„TEIL C", wo das Dungeon-Cockpit sie nicht findet (es liest nur direkte Kinder).

Die richtige Frage ist **„wovon handelt dieser Abschnitt?"**. Sie beantwortet
`restructureDocument` (`semantic/restructure.ts`) in fünf Durchgängen:

1. **Einordnen** — jeder Knoten bekommt eine `SectionRole` (`semantic/roles.ts`). Die
   Gliederungsnummer wandert vom Titel in die Aliase, damit „siehe C.4.3" und „(F.2)"
   weiterhin auflösbar sind. Titel, die ganz in Großbuchstaben stehen, werden
   zurückgenommen (`DAS DACH` → `Das Dach`); redaktionelle Klammern
   (`(Begegnung, vermeidbar)`) fallen weg, Ortsangaben (`(Ost)`) bleiben.
2. **Auflösen** — Listenabschnitte zerfallen in ihre Einträge (`semantic/blocks.ts`):
   „Die Räume" in Räume, „TEIL F — WERTEBLÖCKE" in elf NSC-/Monsterseiten, „TEIL G —
   HANDOUTS" in sechs Handouts. Reine Gliederungsklammern ohne eigenen Text („TEIL C —
   DER TURM", „Die drei Zugänge") verschwinden und geben ihre Kinder nach oben.
3. **Falten** — was keine Seite verdient, wird Rumpftext der Seite darüber. „Was man
   hier lernt" gehört auf die Ebene, auf der man es lernt.
4. **Ordnen** — im Dungeon-Profil hängen Ebenen **immer** direkt unter dem Dungeon, und
   ein Raum außerhalb jeder Ebene wird zum Ort. Das ist eine Invariante, keine
   Nebenwirkung: Genau ihr Fehlen ließ das Cockpit von acht Ebenen eine zeigen.
5. **Typisieren** — aus der Rolle wird der `PageType`.

Danach werden **Namen im Text zu Wikilinks** (`semantic/crosslink.ts`): der erste Fund
pro Seite, nie in Überschriften, Tabellen, Codeblöcken oder bestehenden Links, nie auf
sich selbst. Und **doppelt beschriebene Gegenstände werden zusammengeführt** — eine
Person, die im Kapitel auftaucht und im Werteblock-Anhang noch einmal, ist eine Seite.

Zwei Aufräumschritte aus `buildDocumentTree` gelten unverändert:

- **Titelblock**: führende Kinder ohne eigenen Text und ohne Kinder sind Untertitel und
  wandern in die Wurzelseite. Sonst entstünden aus `### Ein Dungeon für FTKJ · Stufe 8`
  leere Wiki-Seiten.
- **Inhaltsverzeichnis**: Abschnitte namens „INHALT"/„INHALTSVERZEICHNIS" ohne Unterseiten
  fallen weg — im Wiki ist der Baum die Navigation.

Am Magisterturm gemessen: vorher 1 Dungeon mit 1 Ebene, nachher 8 Ebenen, 4 Räume,
8 Begegnungen, 2 Rätsel, 10 Werteblöcke (je mit Werte-Unterseite im DM-Bereich),
6 Handouts, 3 Orte — 35 Wikilinks gesetzt, 40 Abschnitte eingefaltet.

### Typ-Profile

Die Muster in `profiles.ts` und `semantic/roles.ts` belegen vor:

| Profil | Beispiele |
|---|---|
| `campaign_book` | „Szene 1: …" → `encounter`, „KAPITEL 13: NEBENQUESTS" → `quest`, „4.1 Die Handelsgilde …" → `faction` |
| `dungeon` | Wurzel → `dungeon`, „EBENE 1 …" → `dungeon_level`, Aufzählungen unter „Die Räume" → `room`, „DIE WURZELPLATTFORM" → `dungeon_level` (Außenbereich) |
| `canon` | alles `lore`, Vorgabe-Status `canon` |

### Das Konvertierungstemplate zum Dungeon-Profil

Die Regeln erkennen nur, was das Dokument auch trägt: Eine Falle mitten im
Fließtext kommt ohne eigene Überschrift nicht als `trap`-Seite an.
`@uwe/doc-import` exportiert deshalb `DUNGEON_CONVERSION_TEMPLATE`
(`dungeon-template.ts`) — ein vollständiges Beispiel-Dokument in genau der Form,
die das Dungeon-Cockpit liest: Ebenen und Räume als Überschriften, darunter
`Begegnung:`, `Falle:`, `Rätsel:`, `Beute:` und `Geheimnis:` als eigene
Unterüberschriften, dazu nummerierte Werteblöcke und Handouts. Die
Import-Zentrale bietet die Vorlage beim Profil „Dungeon" zum Kopieren und
Herunterladen an (`DungeonTemplateCard`) — als Gerüst zum Selberfüllen oder als
Konvertierungsauftrag an eine KI. `dungeon-template.test.ts` importiert die
Vorlage bei jedem Testlauf und stellt sicher, dass jede Gegenstandssorte
ankommt; ändert eine Regel das Verhalten, bricht der Test statt der Vorlage.

> **Deutsche Komposita:** `\bgilde\b` findet „Handelsgilde" nicht. Die führende Wortgrenze
> steht deshalb nur dort, wo sie einen Fehltreffer verhindert (`\borden\b`, sonst würde
> „Norden" zur Fraktion). Aus demselben Grund steht vor `plattform` keine — sonst wäre
> „Die Wurzelplattform" keine Ebene.

> **Ebenen nur am Anfang:** „Startbedingungen (abhängig von Ebene 6)" ist keine Ebene.
> Das Muster verlangt die Angabe am Zeilenanfang oder hinter einem Gedankenstrich.

> **Muster ohne Mehrdeutigkeit:** Die Überschriftenzeile wird von Hand gelesen, nicht
> von einer Regex. `^(#{1,6})[ \t]+(.*\S)[ \t]*$` sieht harmlos aus, aber `[ \t]+` und der
> Titel dahinter streiten um dieselben Zeichen; eine Zeile aus lauter Leerzeichen kostete
> gemessene 234 ms — pro Zeile, bei 1 778 Zeilen pro Buch. Dieselbe Falle steckte in
> `\s+([),.:;])`, in `<[^>]*>` und in `\[\[([^\]|]+)…` (dort läuft ein Ziel über das
> nächste `[[` hinweg, deshalb ist `[` jetzt aus der Zeichenklasse ausgeschlossen).
> Faustregel: Wo ein `+`/`*` und das, was danach kommt, dieselben Zeichen fressen können,
> ist die Laufzeit quadratisch. Der Regressionstest dazu steht in `redos.test.ts`.
>
> Aus demselben Grund entfernt `stripTags` Markup Zeichen für Zeichen: ein einzelner
> `replace(/<[^>]*>/g, "")` ist als Entferner grundsätzlich unvollständig — was er stehen
> lässt, kann zu dem zusammenwachsen, wonach er gesucht hat.

**Kanon-Marker:** `◆` (Kanon) und `◇` (Vorschlag) im Überschriftentext werden zu
`CanonicalStatus` und aus dem Titel entfernt.

### Das Werteblock-Muster

Werteblöcke und Handouts sind **keine Überschriften**, sondern nummerierte Fettschrift:

```markdown
**F.2 Bannläufer** (3 in C.1.3) — *Mittelgroßer Konstrukt*
**RK** 17 · **TP** 68 · **Tempo** 9 m
```

Ein neuer Block beginnt nur an einer Zeile mit `**` **und** einer Gliederungsnummer —
`**RK** 17` hat keine und bleibt beim laufenden Block. Und herausgelöst wird
ausschließlich in Abschnitten, deren Rolle das vorsieht (`statblock_list`,
`handout_list`, `npc_list`, `room_list`); in gewöhnlichem Fließtext passiert nichts.

### Beschreibung und Werte sind zwei Seiten

Ein Werteblock ist im Buch beides in einem: eine Zeile darüber, wer das ist, darunter
die Zahlen. Im Wiki sind das zwei verschiedene Dinge — das eine schlägt man nach, wenn
man wissen will, wem man begegnet, das andere, wenn gewürfelt wird. Also:

```
Bannläufer                     ← Hauptseite: „Mittelgroßer Konstrukt, ordnungsgemäß"
└─ Werteblock: Bannläufer      ← Unterseite: RK 17 · TP 68 · Multiattacke …
```

Die Unterseite liegt in einem **DM-Bereich** (`:::dm … :::`, siehe
[access-model.md](access-model.md)): Der Server schneidet ihn aus jedem Lesepfad,
bevor Inhalt jemanden ohne Studio-Häkchen erreicht. Die Hauptseite kann man also am
Spieltisch zeigen, ohne die Werte preiszugeben.

Getrennt wird **an der ersten Zeile, die mit einem 5e-Marker anfängt** (`RK`, `TP`,
`Multiattacke`, `Rettungswürfe` …). Nur am Zeilenanfang: „kein Kampfblock. Ein
130-jähriger Mensch im Tiefschlaf, TP 9, hilflos." erwähnt Trefferpunkte, ist aber
Beschreibung. Und getrennt wird nur, wo es etwas zu trennen gibt — ein Block ganz ohne
Wertezeilen („Kein Kampf. Er kämpft nie.") bleibt eine Seite. Eine leere Hauptseite
wäre schlimmer als die Doppelung, die hier vermieden werden soll.

### DM-Bereiche überleben die Zerlegung

Ein `:::dm … :::` im Quelltext kennt die Seitengrenzen nicht, die beim Umbau erst
entstehen. Ohne Gegenmaßnahme landet die öffnende Marke auf der Wurzelseite und die
schließende drei Kapitel später — und das Ergebnis zeigt genau in die falsche
Richtung: Die Wurzelseite schneidet sich fail-closed selbst ab, **die Kapitel
dazwischen tragen gar keine Marke mehr** und stehen offen. Ein Autor, der einen
Band ausdrücklich als DM-Material gekennzeichnet hat, hätte ihn damit veröffentlicht.

`semantic/dm-balance.ts` läuft deshalb einmal über die Seiten **in
Dokumentreihenfolge** und trägt mit, ob gerade ein Bereich offen ist: Wer in einem
offenen Bereich auf einer Seite ankommt, bekommt die Marke dort neu gesetzt; wer
eine Seite mit offenem Bereich verlässt, bekommt sie geschlossen. Der Titel wandert
mit, damit im Studio über jedem Teilstück derselbe Kasten steht.

Die abgelegte Originaldatei (`import/quelltext`) bleibt außen vor — sie ist der
unveränderte Beleg und trägt ihre Marken ohnehin ausgeglichen.

> **Für den Bulk-Wiki-Modus gilt das nicht**, dort ist eine Datei eine Seite und
> eine Marke kann keine Grenze überschreiten.

### Was die Welt schon weiß

Der Import las ein Dokument lange, als wäre es das erste in dieser Welt. Das ist fast
nie so: „Windhafen" ist längst ein Ort, „Xarza" längst eine Person, und beides steht in
der Datenbank, in die dieser Import ohnehin schreibt. `world-context.ts` nutzt das
zweifach:

1. **Deterministisch.** Trägt eine Überschrift den Namen einer vorhandenen Seite,
   übernimmt der Import deren Typ. Kein Raten, kein Maschinenraum-Host nötig — genau die Fragen,
   an denen die Titelmuster scheitern, denn einem Namen sieht man nicht an, was er ist.
2. **Als Kontext für die KI.** Die im Dokument tatsächlich vorkommenden Namen gehen mit
   in die Anfrage. Geschnitten wird am Text selbst: Eine Welt mit tausend Seiten passt
   weder in die Anfrage noch in den Nutzen.

Zusätzlich werden diese Namen zu Verlinkungszielen — der Import verweist damit auf den
vorhandenen Weltbestand, statt nur auf sich selbst.

Drei Vorsichtsmaßnahmen, jede aus einem Fehltreffer entstanden:

- Nur **Gegenstandstypen** (`npc`, `monster`, `location`, `region`, `faction`, `item`,
  `dungeon`, `quest`). Dass es eine Seite „Kapitel 3" gibt, sagt über eine gleichnamige
  Überschrift nichts.
- Namen unter vier Zeichen bleiben draußen. Ein Ort namens „Ost" träfe sonst „Die
  Wachstube (Ost)" und jede Himmelsrichtung.
- **Die Gliederung wiegt schwerer.** „KAPITEL 2 — WINDHAFEN" ist ein Kapitel über
  Windhafen, nicht die Stadt: Als Ort eingeordnet verlöre es seine Rolle als Klammer,
  löste sich auf, und seine Szenen hingen im Nichts — während die Stadt, die es schon
  gibt, eine zweite Seite bekäme. Ebenso schlägt die Stellung im Dokument den
  Namensfund: Ein Eintrag unter „Werteblöcke" ist ein Werteblock.

> **Kein MCP.** Der Welt-Kontext kommt direkt aus dem Repository. Der Studio-MCP wäre
> ein HTTP-Client auf die eigene laufende Instanz — der Import aus dem Command Center
> liefe dann nur, solange Studio läuft, obwohl beide auf derselben Maschine neben
> derselben Datenbank sitzen.

### KI-Feinschliff (optional, lokal)

Was die Regeln nicht können, ist ein Name ohne Amtsbezeichnung: „Tibbik Moosfunke" ist
eine Person, „Windhafen, die Boomstadt" ein Ort, und beides steht dem Titel nicht an.
Dafür gibt es `@uwe/doc-import/ai` → `collectRoleHints`: Die Gliederung samt Anreißern
geht **an den Maschinenraum-Host** (`providerMode: "local_engine"`), zurück kommen Rollen zu
**vorhandenen** Pfaden. Alles, was nicht auf einen bekannten Abschnitt zeigt, fällt weg —
das Modell kann diesem Import keine Inhalte hinzufügen.

Ist der Host stumm, wirft nichts: Der Import läuft über die Regeln, und der Grund steht
in den Warnungen der Vorschau. Weil der Host nicht deterministisch ist, wird sein Urteil
**einmal in der Vorschau** eingeholt, in `ImportJob.metadata.docImportRoleHints` abgelegt
und beim Ausführen von dort gelesen: Angelegt wird, was bestätigt wurde.

### Die Zuordnung ist eine Vorbelegung

Regeln, Welt-Wissen und KI ergeben zusammen eine gute Vorbelegung — keine Wahrheit.
Deshalb steht der Typ jeder Seite in der Vorschau als Auswahlfeld und lässt sich dort
ändern, bevor geschrieben wird (`typeOverrides` in `writeDocImport`, nach
Entwurfs-Schlüssel). Ohne diese Möglichkeit hieße eine danebenliegende Rolle: nach dem
Import 63 Seiten einzeln nachbessern — also genau die Arbeit, die der Import abnimmt.

Die Korrekturen greifen erst beim Schreiben und ändern den Plan nicht. Der Weg von
Markdown zu Seitenentwürfen bleibt damit deterministisch, und die Vorschau zeigt
weiterhin, was der Import von sich aus erkannt hat.

### Die Originaldatei bleibt liegen

Falten, Auflösen und Zusammenführen heißt auch, dass niemand mehr Zeile für Zeile
nachprüfen kann, ob etwas untergegangen ist. Deshalb legt der Dokument-Modus die
unveränderte Datei als Beleg-Seite neben den Band: Typ `note`, Tag `import/quelltext`,
zugeklappt. Die Leseansicht lässt sie draußen und verlinkt sie am Ende.

## 5. Lesereihenfolge

`Page.sortIndex` (nullable) ordnet Geschwister. `NULL` sortiert nach hinten, damit
Bestandsseiten sich verhalten wie bisher. `@uwe/session-runner` rechnet daraus die
Lesereihenfolge (Tiefensuche, Eltern vor Kindern, Zyklenschutz).

## 6. Leseansicht: ein Band am Stück

Der Seitenbaum ist die richtige Form zum **Nachschlagen** und die falsche zum **Lesen**.
`/worlds/[slug]/lesen` listet die Bände einer Welt (Seiten mit Unterseiten, die selbst
unter keiner hängen), `/worlds/[slug]/lesen/[pageSlug]` setzt einen davon wieder zu einem
fortlaufenden Text zusammen — Inhaltsverzeichnis links, Sprungmarken je Abschnitt, jeder
Abschnitt verlinkt auf seine Wiki-Seite. Lesen hier, bearbeiten dort.

Gerechnet wird das in `@uwe/session-runner` (`volume.ts`, rein) auf **derselben**
Lesereihenfolge wie der Runner — es gibt nicht zwei Vorstellungen davon, was „als
Nächstes" heißt. Das HTML kommt aus dem zwischengespeicherten Welt-Graphen
(`getWorldWikiGraph`), nicht aus 55 Einzelabfragen.

## 7. Session-Runner

Auf `/worlds/[slug]/sessions/[id]/live`: links der Kapiteltext, rechts der nachgeschlagene
Eintrag. Ein Klick auf `[[Xarza]]` **navigiert nicht** — ein delegierter Handler auf
`a.wiki-link` fängt ihn ab und lädt das Ziel über
`GET /api/worlds/[worldSlug]/reader/[pageSlug]` ins rechte Pane. Strg/Cmd- und Mittelklick
bleiben normal.

- Teiler ziehbar, Verhältnis in `localStorage`.
- Unter `lg` wird das rechte Pane eine Schublade. Die Sichtbarkeit hängt an einer
  Media-Query, **nicht** an `lg:hidden`: Radix portaliert Sheet-Inhalt an `document.body`,
  wo eine Klasse am Elternteil nichts mehr ausrichtet.
- Leseposition über `SessionLiveEntry` vom Typ `bookmark` (`refPageId` + `payload`).
  Automatische Positionen ersetzen einander, ausdrückliche bleiben stehen.

### Neue API-Routen brauchen einen Allowlist-Eintrag

`packages/auth/src/security/route-policy.ts` ist **deny-by-default**: eine API-Route ohne
Eintrag in `PROTECTED_ROUTE_PREFIXES` antwortet mit `404 API-Route nicht gefunden` — auch
für angemeldete Nutzer.

> **Fallstrick:** `matchesRoutePattern` behandelt ein Muster, das auf `/*` endet, als reinen
> **Präfixvergleich**. Ein `*` weiter vorne wird dann nicht mehr ersetzt, und das Muster
> trifft nie. `/api/worlds/*/reader/*` funktioniert also **nicht** —
> `/api/worlds/*/reader/[pageSlug]` funktioniert. Dieselbe Falle betrifft
> `/api/worlds/*/spotify/*`, das dadurch aktuell unerreichbar ist.

## 8. Fremdes Material

Es gibt seit dem 26.07.2026 **kein `dm_only`** mehr; wer einer Welt zugeordnet ist, sieht
alles darin. Die Welt ist damit die einzige Trennlinie:

1. Fremden Band in eine **Werkstatt-Welt ohne Spieler-Zuordnung** importieren.
2. Dort sichten; der Einordnungs-Chat (`CampaignFitChatCard`) hilft beim Einpassen.
3. Kuratierte Seiten über die Massenaktion **„In andere Welt übernehmen"** weiterschieben.

Übernommen werden Seiten, Blöcke, Hierarchie und Reihenfolge. **Nicht** übernommen werden
`PageLink`-Kanten und Kampagnen der Quellwelt — Kanten zeigen auf Seiten-IDs, die in der
Zielwelt nichts bedeuten. Die Vorschau meldet, welche `[[Links]]` danach ins Leere zeigen.

Die Herkunft steht in den Block-Metadaten (`sourceTitle`, `licence`, `transferredFrom`) und
wird bei `licence: "third_party"` auf der Seite angezeigt.

## Verwandte Dokumente

- [access-model.md](access-model.md) — Häkchen-Modell und Welt-Zuordnung
- [pdf-campaign-import-plan.md](pdf-campaign-import-plan.md) — PDF-/OCR-Pfad
- [information-architecture.md](information-architecture.md) — Studio-Navigation
