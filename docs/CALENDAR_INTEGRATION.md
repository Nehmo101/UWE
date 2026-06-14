# Kalender-Integration

Lokaler UWE-Kalender mit CalDAV/iCal-Sync, Session-Terminplanung und FamilyWall read-only.

## Features

- Lokaler Kalender (`CalendarFeed` type `local`)
- Termine anlegen (Session, Prep, DnD, Persönlich)
- `.ics` Export via `/api/calendar/events?export=ics`
- iCal-Abonnements (read-only): iCloud public, Nextcloud, Radicale, Fastmail
- CalDAV-Sync (minimal: iCal über CalDAV-URL)
- FamilyWall read-only über iCal-Link (`type: familywall`)
- Sync als Hintergrund-Job (`calendar_sync`)

## ENV

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `CALENDAR_ENABLED` | `true` | Feature aktiv |
| `CALENDAR_CALDAV_ENABLED` | `false` | CalDAV explizit aktivieren |
| `CALENDAR_FAMILYWALL_ENABLED` | `true` | FamilyWall Feeds erlaubt |
| `CALENDAR_DEFAULT_TIMEZONE` | `Europe/Berlin` | Anzeige |
| `CALDAV_PASSWORD` | — | Serverseitig, nie im UI |

## FamilyWall

1. FamilyWall App → Kalender → iCal-Link kopieren
2. `/calendar` → Feed hinzufügen → Typ `familywall` oder `ical_url`
3. URL einfügen → Sync startet automatisch
4. **Read-only** — keine Rücksync nach FamilyWall

## CalDAV (iCloud, Nextcloud, Radicale)

1. CalDAV-URL + Benutzername in Feed-Formular
2. Passwort als `CALDAV_PASSWORD` in `.env` (global, Phase 1)
3. Sync-Job lädt iCal/CalDAV-Inhalt

## Session-Termine

- Art `session` oder `dnd` wählen
- Optional `worldId` und später `sessionId` verknüpfen
- GameSession.date kann separat gepflegt werden — Sync-Service TODO Phase 2

## Admin-UI

- `/calendar` — mobile-first
- Einstellungen → Integrationen

## Package

`@uwe/calendar` — iCal parse/generate, fetch helpers

## Risiken

- CalDAV-Vollsync (bidirektional) nicht in Phase 1 — nur Import
- iCloud erfordert oft app-spezifisches Passwort
- Timezone-Handling vereinfacht (UTC in iCal)

## Phase 2 TODO

- Pro-Feed CalDAV-Passwort (verschlüsselt)
- Zwei-Wege-Sync für lokale Feeds
- Monats-/Wochen-Kalender-UI
- Session ↔ CalendarEvent Auto-Sync
