---
name: uweportal
description: UWE Portal — das Spieler-Wiki auf Port 3001. Spielersicht prüfen, Tischmodus mit Offline-Snapshot und Service Worker, Charaktere, Notizen, Handouts, Karten, Schatzkammer. Nutze das für jede Aufgabe in apps/portal, für die Frage „was sieht ein Spieler wirklich?" und für die MCP-Tools portal_*.
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

## Tischmodus

Der jüngste und am wenigsten offensichtliche Teil des Portals — für den Spielabend
gebaut, funktioniert offline:

- UI in `apps/portal/src/components/table-mode/` — `TableModeClient.tsx`,
  `CharacterCard.tsx`, `TreasuryCard.tsx`, `NotesOffline.tsx`,
  `offline-store.ts`, `sync-runner.ts`, `offline-reset.ts`
- Service Worker `apps/portal/public/sw.js`, registriert über
  `apps/portal/src/components/ServiceWorkerRegistrar.tsx`
- Web-App-Manifest als Route: `apps/portal/app/manifest.ts`
- Einstieg `/auth/tisch`
- Routen dahinter: `apps/portal/app/api/worlds/[worldSlug]/offline-snapshot/route.ts`
  (Snapshot ziehen) und `.../notes/sync/route.ts` (Notizen zurückspielen)
- Geteilte Logik in `packages/player-hub`

Wer hier etwas ändert, muss an beides denken: Snapshot **und** Sync. Ein Snapshot,
der mehr enthält als die Spielersicht, ist ein Leak — der Offline-Store liegt im
Browser des Spielers.

Notizen hängen an Sessions: der Snapshot trägt die **aktive Session** (jüngste
für Spieler sichtbare, `activeSession` im `PortalOfflineSnapshot`), der
Tischmodus hängt neue Notizen daran; die Notizen-Übersicht bietet die Session
als Dropdown an (Default: aktive Session, „Ohne Session" explizit). Die
Kampagne folgt dabei serverseitig immer der Session — zentral in
`createPlayerNoteForViewer`, Sessions fremder Welten werden verworfen.

## Aufbau

Navigation in `apps/portal/src/navigation/portal-nav.ts`: `PORTAL_NAV` (Weltenliste,
Konto), `portalWorldNav()` (Wiki, NPCs, Graph, Sessions, Schatzkammer, Zeitleiste,
Quests, Charaktere, Handouts, Assets, Notizen, Fragen, Soundboard, Karten) und
`shareNavGroups()` für Freigabe-Links.

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
| Tischmodus-Änderung | Snapshot-Route **und** Sync-Route anfassen, danach `pnpm test:security` |

Karte: `references/karte.md` · Depth: `docs/engineering/portal-security.md`,
`docs/engineering/mcp-servers.md`, `docs/engineering/access-model.md`
