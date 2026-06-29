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
| **CalDAV** | read-only oder write-back | `CALENDAR_CALDAV_ENABLED=true`, per-Feed Credentials |

FamilyWall und iCloud public feeds werden als `personal`/`external` importiert — keine Rücksync.

## Admin-UI

- `/calendar` — Monats-/Wochenansicht, Feed-Verwaltung
- `/today` — aggregierte Termine und Fristen
- Einstellungen → Integrationen

## Package

`@uwe/calendar` — iCal parse/generate, fetch helpers

## Risiken

- CalDAV-Vollsync (PROPFIND/REPORT) implementiert; UI legt externe Feeds weiterhin standardmäßig als `read_only` an
- iCloud erfordert oft app-spezifisches Passwort
- Timezone-Handling vereinfacht (UTC in iCal)
- Feed-URLs werden gegen SSRF geprüft (kein Fetch auf localhost/private IPs)
- `CALENDAR_CALDAV_ENABLED` und `CALENDAR_FAMILYWALL_ENABLED` werden in API und Server Actions enforced

## Phase 2 TODO

- Optionale Spiegelung virtueller `/today`-Fristen in lokale CalendarEvents
- Delete-Sync (`deleteCalDavEvent`) wo Provider es unterstützen

**Erledigt:** Bidirektionaler Write-back (`putCalDavEvent`), CalDAV PROPFIND/REPORT-Vollsync (`syncCalDavCollection`), Session ↔ `CalendarEvent` (`syncSessionToCalendar`), Kalender auf `/today`.
