# Dokument-Import & Session-Runner

Stand: 2026-08-01.

Zwei Hälften desselben Problems: **wie kommen fertige Texte nach UWE** — und **wie
benutzt man sie am Spieltisch, ohne beim Nachschlagen die Stelle zu verlieren**.

---

## 1. Was für Material es gibt

| Sorte | Beispiel | Weg |
|---|---|---|
| Wiki-Seiten im Bulk | 200 NSC-Dateien aus dem Vault | Import-Zentrale → Welt → **Wiki-Seiten** |
| Kampagnenbuch, Dungeon, Weltkanon | ein langes Markdown | Import-Zentrale → Welt → **Dokument / Buch** |
| Fremdes Kampagnenbuch | gekaufte PDF | PDF → Kampagne in eine **Werkstatt-Welt**, dann übernehmen |

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

## 4. Dokument → Seitenbaum

`buildDocumentTree` zerlegt an den Überschriften, `maxDepth` bestimmt, wie tief eigene
Seiten entstehen; alles darunter bleibt als Markdown im Rumpf. Zwei Aufräumschritte:

- **Titelblock**: führende Kinder ohne eigenen Text und ohne Kinder sind Untertitel und
  wandern in die Wurzelseite. Sonst entstünden aus `### Ein Dungeon für FTKJ · Stufe 8`
  leere Wiki-Seiten.
- **Inhaltsverzeichnis**: Abschnitte namens „INHALT"/„INHALTSVERZEICHNIS" ohne Unterseiten
  fallen weg — im Wiki ist der Baum die Navigation.

Typ-Profile (`profiles.ts`) belegen den `PageType` aus der Überschrift vor:

| Profil | Beispiele |
|---|---|
| `campaign_book` | „Szene 1: …" → `encounter`, „KAPITEL 13: NEBENQUESTS" → `quest`, „4.1 Die Handelsgilde …" → `faction` |
| `dungeon` | Wurzel → `dungeon`, „C.1 EBENE 1 …" → `dungeon_level`, „Die Räume" → `room` |
| `canon` | alles `lore`, Vorgabe-Status `canon` |

> **Deutsche Komposita:** `\bgilde\b` findet „Handelsgilde" nicht. Die führende Wortgrenze
> steht deshalb nur dort, wo sie einen Fehltreffer verhindert (`\borden\b`, sonst würde
> „Norden" zur Fraktion).

**Kanon-Marker:** `◆` (Kanon) und `◇` (Vorschlag) im Überschriftentext werden zu
`CanonicalStatus` und aus dem Titel entfernt. Die Abschnittsnummern bleiben stehen — die
Dokumente verweisen untereinander über genau sie („himmelsrouten 7.4").

## 5. Lesereihenfolge

`Page.sortIndex` (nullable) ordnet Geschwister. `NULL` sortiert nach hinten, damit
Bestandsseiten sich verhalten wie bisher. `@uwe/session-runner` rechnet daraus die
Lesereihenfolge (Tiefensuche, Eltern vor Kindern, Zyklenschutz).

## 6. Session-Runner

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

## 7. Fremdes Material

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
