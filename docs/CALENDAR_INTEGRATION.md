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

- `GameSession.date` wird beim Anlegen/Aktualisieren automatisch als `CalendarEvent` (`kind: session`) im lokalen Feed gespiegelt
- Datum entfernt → verknüpftes Kalender-Event wird gelöscht
- `/today` aggregiert Sessions, Vertragsfristen, Werkstatt-Deadlines (`metadata.dueDate`), Hardware-Wartung (`metadata.maintenanceDueAt`), Backup-Prüfung und externe Feeds

## Sync-Strategie

| Modus | Richtung | Status |
|-------|----------|--------|
| **Lokal** | read/write | Standard-Feed `UWE Kalender` |
| **iCal Export** | Export | `/api/calendar/events?export=ics` |
| **iCal URL / FamilyWall** | read-only Import | `calendar_sync` Job |
| **CalDAV (Import)** | read-only Import | `CALENDAR_CALDAV_ENABLED=true`, per-Feed Credentials |
| **CalDAV-Server (Family)** | bidirektional (iPhone ↔ lokaler Feed) | `/api/dav`, Token `uwedav_`, siehe `docs/family/kalender.md` |

FamilyWall und iCloud public feeds werden als `personal`/`external` importiert — kein Rücksync.
Der frühere Write-back an fremde CalDAV-Server ist entfernt: bidirektional geht über den
Family-CalDAV-Server, fremde Abos sind strukturell read-only.

## Admin-UI

- `/calendar` — Monats-/Wochenansicht, Feed-Verwaltung
- `/today` — aggregierte Termine und Fristen
- Einstellungen → Integrationen

## Package

`@uwe/calendar` — iCal parse/generate, fetch helpers

## Risiken

- CalDAV-Vollsync (PROPFIND/REPORT) implementiert; externe Feeds sind strukturell read-only
- iCloud erfordert oft app-spezifisches Passwort
- Timezone-Handling beim Import vereinfacht (UTC in iCal); TZID-Lokalzeiten werden seit dem CalDAV-Server korrekt umgerechnet (`ical-timezones.ts`)
- Feed-URLs werden gegen SSRF geprüft (kein Fetch auf localhost/private IPs)
- `CALENDAR_CALDAV_ENABLED` und `CALENDAR_FAMILYWALL_ENABLED` werden in API und Server Actions enforced

## Phase 2 TODO

- Optionale Spiegelung virtueller `/today`-Fristen in lokale CalendarEvents
- sync-collection-REPORT für den Family-CalDAV-Server (Sync-Token statt ctag-Polling)

**Erledigt:** CalDAV PROPFIND/REPORT-Vollsync (`syncCalDavCollection`), Session ↔ `CalendarEvent` (`syncSessionToCalendar`), Kalender auf `/today`, CalDAV-Server fürs iPhone (`/api/dav`, `docs/family/kalender.md`) — der frühere Write-back (`putCalDavEvent`) ist damit ersetzt und entfernt.
