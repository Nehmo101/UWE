---
name: uwestudio
description: UWE Studio — die DM- und Admin-App auf Port 3000. Welten, Wiki-Seiten, DnD-Brain, Jobs, Image Studio, Import, Prompts, Templates, Daily Admin OS, Einstellungen und Admin. Nutze das für jede Aufgabe in apps/studio, für Server Actions, für dm_only-Inhalte und `:::dm`-Bereiche, und für die MCP-Tools studio_*.
---

# UWE Studio

Die App, in der die Welt gebaut wird. Alles Schreibende passiert hier — das Portal
ist nur die gefilterte Leseseite derselben Daten. Wer eine Portal-Inhaltsfrage
stellt, landet fast immer trotzdem in Studio, weil Portal-Inhalte ausschließlich
hier gepflegt werden.

Größter Bereich im Repo: 89 Seiten, 146 API-Routen, 30 Server-Action-Dateien,
30 `@uwe/*`-Pakete. Vollständige Karte: `references/karte.md`.

## MCP-Tools

<!-- uwe:generated:mcp start -->
13 Tools am MCP-Server `uwe-studio`, davon 2 nur mit Freigabe-Flag.

| Tool | Verfügbar | Zweck |
|------|-----------|-------|
| `studio_health` | immer | Health-Report von UWE Studio: Datenbank, Migrationen, Storage, Seeds, Proxy, Mail und Version. |
| `studio_search` | immer | Domänenübergreifende Suche über Wiki-Seiten und Admin-Objekte (Ideen, Projekte, Kontakte …). |
| `studio_world_brain` | immer | DnD-Brain einer Welt: Dokumente, Fakten und Welt-Zusammenfassung. |
| `studio_world_graph` | immer | Beziehungsgraph einer Welt (Knoten + Kanten). |
| `studio_settings` | immer | Aktuelle System-Einstellungen von UWE (Portal-Freigabe, Backup-Zeitplan, KI-Defaults, Feature-Flags …). |
| `studio_jobs` | immer | Job-Queue mit Status-Zusammenfassung: Exporte, Importe, KI-Läufe, Backups. |
| `studio_ai_models` | immer | Verfügbare KI-Modelle je Provider (lokaler Maschinenraum, Cloud-Provider). |
| `studio_dnd_spell_search` | immer | Zaubersuche über die konfigurierten DnD-Referenzquellen (Open5e / SRD). |
| `studio_dnd_equipment_search` | immer | Ausrüstungs- und Magieitem-Suche über die konfigurierten DnD-Referenzquellen. |
| `studio_admin_status` | immer | Admin-Dashboard-Status als JSON (Dienste, Inferenz, Rate-Limiter, Warnungen). |
| `studio_audit_log` | immer | Audit-Log-Einträge (Logins, Rechteverweigerungen, Admin-Aktionen). |
| `studio_create_brain_entry` | `UWE_MCP_ALLOW_WRITES` | Legt ein Brain-Dokument oder einen Fakt in einer Welt an. |
| `studio_enqueue_job` | `UWE_MCP_ALLOW_WRITES` | Reiht einen Job in die Studio-Queue ein (z. B. Export, Import, Backup). |

Fehlt ein gegatetes Tool, ist das **kein Fehler** — dann ist das Flag nicht gesetzt.
Das dem Nutzer sagen, statt einen Umweg zu suchen.
<!-- uwe:generated:mcp end -->

Bei 401/403 zuerst Token und Scopes prüfen (Studio → Admin → API-Tokens), nicht an
den Guards vorbeiarbeiten. `studio_admin_status` braucht `admin_read`,
`studio_settings` braucht `settings_read`.

## Zugang und Sichtbarkeit

Zugang ist ein Häkchen pro E-Mail, kein Rollen-Enum: `canAccessStudio`
(`packages/auth/src/area-access.ts`). Welcher Inhalt sichtbar ist, entscheidet die
Welt-Zuordnung (`packages/auth/src/permissions.ts`) — wer einer Welt zugeordnet
ist, sieht alles darin. `owner` ist die einzige verbliebene Rolle und deckt Betrieb,
Restore und Command Center ab.

Zwei Sonderfälle, die man in Studio ständig trifft:

- **`:::dm … :::`** — DM-Bereiche im Wikitext. Sie werden **serverseitig aus dem
  Text geschnitten**, nicht per CSS ausgeblendet: `canReadDmSections` /
  `filterBlocksForViewer` (`packages/auth/src/permissions.ts`), Parser in
  `packages/auth/src/dm-section.ts`. Nur wer das Studio-Häkchen trägt, liest sie —
  Welt-Zuordnung reicht nicht, und die Vorschau-als-Spieler fällt heraus.
- **`User.aiAccess`** — kein fünftes App-Häkchen, sondern eine Kontofähigkeit:
  darf diese Adresse die RTX-KI benutzen. Durchgesetzt über `canUseRtxAi`, die
  Pfadregel für KI-API-Routen und `require*AiActionAuth` für KI-Server-Actions.

Studio zeigt bewusst auch `dm_only`-Inhalte. Die dürfen **niemals** in
Portal-Ausgaben, Exporte oder spielerseitige Texte wandern.

## Aufbau

Die Shell sitzt **einmal** im Root-Layout. Eine neue Seite gibt nur Inhalt zurück —
kein Shell-Wrapper, keine eigene Sidebar. Die aktive Welt ist Context + Cookie, kein
Rahmenwechsel (`docs/engineering/studio-shell.md`).

Navigationsziele kommen aus `apps/studio/src/navigation/`:
`studio-nav.ts` (Start, Welten, Wissen, KI, Werkzeuge), `world-nav.ts` (Welt-Cockpit:
Übersicht · Wiki · Spiel · Medien · Wissen & KI · Freigabe & Betrieb),
`system-nav.ts` (Admin-Hub), `organization-nav.ts`.

```
Schema-Änderung   → packages/database/prisma/schema.prisma + Migration
Domain-Logik      → Feature-Package (packages/<domain>), NICHT packages/database
Studio API        → apps/studio/app/api/**/route.ts
Studio UI         → apps/studio/app/**/page.tsx
Server Actions    → apps/studio/app/*-actions.ts
Geteilte UI       → packages/shared-ui/src/
```

Formulare laufen über Server Actions; API-Routen bleiben für Uploads, Health und
externe Callbacks.

## Fallen

- **Neue Einstellung? Nie am Host konfigurieren.** Das Muster ist
  DB-Setting → host-lesbare JSON → systemd liest: Setting in
  `packages/database/src/settings-service.ts` + Validierung in
  `settings-validation.ts`, UI-Toggle, Speichern über `updateSettingsAction`
  (`apps/studio/app/settings-actions.ts`), danach schreibt ein Sync-Wrapper die
  Datei. Details: `docs/engineering/self-service-config.md`.
- **Neue Domänen-Services gehören nicht in `packages/database`.** Das
  `server.ts`-Barrel ist eingefroren (Budget +3 %) — neue Symbole über
  Subpath-Exports oder ein Feature-Package. Service-Index:
  `docs/engineering/database-service-map.md`.
- **Dateigröße:** neue Dateien max. 700 Zeilen. Baselines in
  `scripts/file-size-baseline.json` niemals erhöhen.
- **Kein Cross-App-Import.** `apps/studio` importiert nie `apps/portal` — geprüft
  von `scripts/product-boundary-check.mjs`.
- Bei „warum sieht der Spieler das (nicht)?" nicht in Studio raten, sondern
  `/uweportal` nehmen — das liest mit `preview=player` durch dieselben Guards.

## Typische Aufgaben

| Aufgabe | Weg |
|---|---|
| „Läuft alles?" | `studio_health` → `studio_admin_status` → bei Sicherheitsfragen `studio_audit_log` |
| Inhalt finden | `studio_search` (mind. 2 Zeichen) — Wiki-Seiten *und* Admin-Objekte, mit direkten Links |
| Welt einschätzen | `studio_world_brain` (Dokumente, Fakten) + `studio_world_graph` (Struktur) |
| Hängt ein Export/Import? | `studio_jobs` |
| KI antwortet nicht | `studio_ai_models`, dann `studio_admin_status` |
| Regeln nachschlagen | `studio_dnd_spell_search`, `studio_dnd_equipment_search` |
| Neue Studio-Seite | Route unter `apps/studio/app/**/page.tsx`, Nav-Eintrag in `apps/studio/src/navigation/`, **kein** eigener Shell-Rahmen |

Karte: `references/karte.md` · Depth: `docs/engineering/studio-shell.md`,
`docs/engineering/mcp-servers.md`, `docs/engineering/access-model.md`,
`docs/daily-admin-os.md`, `docs/engineering/doc-import-und-session-runner.md`
