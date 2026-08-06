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
und kein Häkchen — Lesen bleibt Welt-Sache. Die Gruppe entscheidet drei Dinge:

- **Gruppenschatz**: jede Runde führt ihre eigene Kasse und Beute selbst
  (`packages/player-hub/src/group-treasury.ts`, UI in
  `apps/portal/src/components/GroupTreasurySection.tsx`).
- **Questlog**: das Portal zeigt nur Quests, die der eigenen Runde zugeordnet
  sind (`Page.questGroupId`, vergeben im Kampagnen-Radar des Studios). Ohne
  Zuordnung erscheint eine Quest bei niemandem.
- **Sessions**: ein Spielabend gehört einer Runde (`GameSession.groupId`,
  gesetzt im Studio im Session-Formular). Die Zuordnung im Studio ist führend;
  das Portal filtert damit Termine, Recaps und die Verfügbarkeits-Abfrage.

Die Session-Regel liest sich anders als die Quest-Regel, und das ist Absicht:
`groupId = null` heißt **welt-weit** — dieselbe Lesart wie beim welt-weiten
Gruppenschatz. Welten ohne Gruppen ändern sich dadurch nicht. Sobald eine Runde
eingetragen ist, sehen den Abend nur deren Mitglieder; wer in **keiner** Runde
sitzt, sieht nur die welt-weiten Abende und nie den einer fremden Runde.

Der Filter sitzt in der Abfrage, nicht in der Anzeige:
`listVisibleToPlayersForPortal` (`packages/database/src/game-session.ts`) bekommt
die Runde des Betrachters, aufgelöst in
`packages/database/src/player-group-scope.ts` — in der Vorschau-als-Spieler die
des vorgeschauten Kontos. `getGameSessionForViewer` wendet dieselbe Regel auf die
Detailseite an, damit eine geratene Session-Id nichts öffnet; die
Verfügbarkeits-Abstimmung und `createPlayerNoteForViewer` hängen daran.

Charaktere legen Spieler selbst im Portal an
(`packages/player-hub/src/player-characters.ts` — Wiki-Seite + leerer Bogen);
die Kampagnen-Zuweisung bleibt im Studio (Kampagnen-Cockpit).

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
| Session fehlt / falsche Session sichtbar | Im Studio: Tischrunde am Session-Formular („Alle Runden“ = welt-weit) und Mitgliedschaft unter `/worlds/[slug]/gruppen` |

Karte: `references/karte.md` · Depth: `docs/engineering/portal-security.md`,
`docs/engineering/mcp-servers.md`, `docs/engineering/access-model.md`
