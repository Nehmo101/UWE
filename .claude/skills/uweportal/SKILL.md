---
name: uweportal
description: UWE Portal — das Spieler-Wiki auf Port 3001. Spielersicht prüfen, Charaktere, Spielernotizen als Logbuch, Handouts, Karten, Gruppenschatz. Nutze das für jede Aufgabe in apps/portal, für die Frage „was sieht ein Spieler wirklich?" und für die MCP-Tools portal_*.
---

# UWE Portal

Die Leseseite. Spieler sehen hier gefilterte, freigegebene Inhalte derselben
Datenbank, die Studio schreibt. **Das Portal pflegt nichts** — für Änderungen an
Inhalten `/uwestudio`.

Eine Regel bestimmt die Sichtbarkeit: **wer einer Welt zugeordnet ist, sieht alles
darin.** Sichtbarkeit pro Eintrag gibt es nicht mehr. Deshalb ist auch der frühere
`portal_leak_check` entfallen — er verglich DM- und Spielersicht auf einzelne
`dm_only`-Einträge, was heute ins Leere liefe.

## MCP-Tools

<!-- uwe:generated:mcp start -->
5 Tools am MCP-Server `uwe-portal` — alle immer verfügbar.

| Tool | Verfügbar | Zweck |
|------|-----------|-------|
| `portal_health` | immer | Liveness des Spieler-Portals. |
| `portal_maintenance_status` | immer | Wartungsmodus des Portals. |
| `portal_player_view_brain` | immer | Welt-Brain in der Spielersicht (accessContext=portal). |
| `portal_player_view_graph` | immer | Welt-Graph in der Spielervorschau (preview=player). |
| `portal_config` | immer | Zeigt, gegen welche Endpunkte dieser MCP-Server arbeitet und ob ein API-Token vorliegt. |
<!-- uwe:generated:mcp end -->

Der Portal-MCP ist **rein lesend**. Portal-eigene Inhaltsrouten sind
session-cookie-only, deshalb lesen die Spielersicht-Tools über Studio mit
`accessContext=portal` bzw. `preview=player` — derselbe Pfad, den das Portal
selbst fährt, also dieselben Guards.

## Zugang und Sichtbarkeit

`canAccessPortal` (`packages/auth/src/area-access.ts`) sagt, ob jemand ins Portal
darf; die Welt-Zuordnung (`packages/auth/src/permissions.ts`) sagt, welche Welt.

Was **nie** ins Portal darf: `dm_only`-Inhalte, unveröffentlichte Seiten und
`:::dm`-Bereiche. Letztere werden serverseitig aus dem Text geschnitten
(`packages/auth/src/dm-section.ts`), nicht ausgeblendet — wer sie im Portal-Output
sieht, hat einen Sicherheitsbefund, keinen Darstellungsfehler.

Geschützt wird das von `scripts/security-leaks.test.ts` und
`packages/security-tests/`. Bei Änderungen an Portal-Ausgaben diese Tests laufen
lassen.

## Tischrunden (Spielergruppen)

Seit 2026-08 gibt es unterhalb der Welt die **Tischrunde** (`PlayerGroup`,
verwaltet in `/uwestudio` unter `/worlds/[slug]/gruppen`). Sie ist kein Recht
und kein Häkchen — Lesen bleibt Welt-Sache. Die Gruppe entscheidet zwei Dinge:

- **Gruppenschatz**: jede Runde führt ihre eigene Kasse und Beute selbst
  (`packages/player-hub/src/group-treasury.ts`, UI in
  `apps/portal/src/components/GroupTreasurySection.tsx`).
- **Questlog**: das Portal zeigt nur Quests, die der eigenen Runde zugeordnet
  sind (`Page.questGroupId`, vergeben im Kampagnen-Radar des Studios). Ohne
  Zuordnung erscheint eine Quest bei niemandem.

Charaktere legen Spieler selbst im Portal an — seit 2026-08 über den
**Charakter-Ersteller** unter `/auth/worlds/<welt>/characters/neu`: neun
Schritte (Volk, Klasse, Hintergrund, Attribute, Fertigkeiten, Ausrüstung,
Zauber, Beschreibung, Übersicht) gegen den SRD-5.2.1-Katalog in
`@uwe/character-creator`. Das Anlegen läuft über
`createFullCharacter` (`packages/player-hub`) in **einer** Transaktion und
prüft den Entwurf serverseitig noch einmal aus dem Katalog nach — dem Browser
wird nichts geglaubt. Angelegt werden Wiki-Seite, Textblock, gefüllter Bogen,
Zauber und Startausrüstung.

Zwei Dinge, die man dazu wissen muss: Das SRD liefert nur **vier**
Hintergründe, und weil seit 2024 die Attributsverteilung daran hängt, finden
Paladin, Mönch und Waldläufer darunter keinen passenden — dafür gibt es den
**Eigenbau-Hintergrund** nach SRD-Bauplan
(`rules/custom-background.ts`). Und `@uwe/character-creator` muss in
`transpilePackages` stehen: Das Paket liefert rohes TypeScript und wird aus
einer `"use client"`-Komponente gelesen.

Der alte Ein-Feld-Weg (`createOwnCharacter` — Wiki-Seite + leerer Bogen)
besteht daneben weiter, für alle, die ihre Werte schon auf Papier haben. Die
Kampagnen-Zuweisung bleibt in beiden Fällen im Studio (Kampagnen-Cockpit).
Offene Punkte: [docs/engineering/character-creator-offene-punkte.md](../../../docs/engineering/character-creator-offene-punkte.md).

Der frühere Tischmodus (Offline-Snapshot, Service Worker, `/auth/tisch`) und
„Fragen an den DM" sind 2026-08 ersatzlos entfernt. Fragen an den Spielleiter
laufen über Spielernotizen mit Sichtbarkeit „Nur GM".

Notizen hängen an Sessions: die Notizen-Übersicht bietet die Session als
Dropdown an (Default: die **aktive Session** — jüngste für Spieler sichtbare;
„Ohne Session" bleibt explizit wählbar). Die Kampagne folgt dabei serverseitig
immer der Session — zentral in `createPlayerNoteForViewer`, Sessions fremder
Welten werden verworfen.

## Aufbau

Navigation in `apps/portal/src/navigation/portal-nav.ts`: `PORTAL_NAV` (Weltenliste,
Konto), `portalWorldNav()` (Wiki, NPCs, Graph, Sessions, Gruppenschatz, Zeitleiste,
Quests, Charaktere, Handouts, Assets, Notizen, Soundboard, Karten) und
`shareNavGroups()` für Freigabe-Links. Wer genau **einer** Welt zugeordnet ist,
landet direkt in ihr — die Weltauswahl erscheint nur bei mehreren Welten
(`?alle=1` erzwingt sie).

Portal-Seiten liegen unter `apps/portal/app/auth/**`, Server Actions als
`apps/portal/app/*-actions.ts`.

## Fallen

- **Kein Cross-App-Import.** `apps/portal` importiert nie `apps/studio`. Geteiltes
  gehört in ein Paket (`packages/player-hub`, `packages/shared-ui`).
- Portal und Studio halten **eigene Kopien** der UI-Primitives. Sechzehn davon
  müssen byte-identisch bleiben — `scripts/ui-primitive-sync.test.ts` erzwingt das.
  Ein Fix an einer Kopie muss in die andere gespiegelt werden.
- Das Portal liest `uwe.db`, hat aber keine eigene. Schema-Änderungen laufen über
  Studio-Seite und Migration.
- Die CSP ist umgebungsabhängig (`packages/auth/src/security-headers.ts`):
  Produktion bleibt strikt. Der Service Worker braucht dort keine Lockerung — wenn
  doch etwas fehlt, erst prüfen, nicht die CSP schwächen.

## Typische Aufgaben

| Aufgabe | Weg |
|---|---|
| „Läuft das Portal?" | `portal_health`, dann `portal_maintenance_status` (sehen Spieler die Wartungsseite?) |
| „Was sieht ein Spieler?" | `portal_player_view_brain` + `portal_player_view_graph` mit dem Welt-Slug |
| Verbindungs-/Token-Problem | `portal_config` zeigt die genutzten Endpunkte |
| Inhalt fehlt im Portal | Nicht im Portal suchen — in Studio prüfen, ob veröffentlicht und die Welt zugeordnet ist |
| Quest fehlt im Questlog | Im Studio prüfen: ist sie im Kampagnen-Radar einer Tischrunde zugeordnet? |

Karte: `references/karte.md` · Depth: `docs/engineering/portal-security.md`,
`docs/engineering/mcp-servers.md`, `docs/engineering/access-model.md`
