# Externe API und MCP

Family war lange nach aussen dicht: ausser Health, Scan-Upload und Rezeptbild gab es keine
Route. Damit konnte auch kein MCP-Server entstehen, denn die sind dünne HTTP-Clients vor der
laufenden App.

## Scopes

| Scope | Erlaubt |
|-------|---------|
| `family_read` | Mitglieder, Termine, Einkaufsliste, Rezepte, Gesundheitsakte lesen |
| `family_write` | Termine anlegen, Einkauf ergänzen, Akte ergänzen, Mitglieder ohne Konto anlegen |
| `family_calendar` | Kalender-Abos auflisten, anlegen, widerrufen |

Token erzeugen: im **Command Center** (Ops-Aktion `api-tokens-create`; CLI:
`tools/uwe-host-command-center` → `ops-cli api-tokens-create`). Der Klartext
erscheint genau einmal in der Antwort.

## Endpunkte

```
GET    /api/v1/members                     family_read
POST   /api/v1/members                     family_write
GET    /api/v1/calendar/events             family_read
POST   /api/v1/calendar/events             family_write
PATCH  /api/v1/calendar/events/{id}        family_write
DELETE /api/v1/calendar/events/{id}        family_write
GET    /api/v1/shopping/items              family_read
POST   /api/v1/shopping/items              family_write
PATCH  /api/v1/shopping/items/{id}         family_write
GET    /api/v1/recipes                     family_read
GET    /api/v1/recipes/{id}                family_read
GET    /api/v1/recipes/{id}/image          family_read
GET    /api/v1/meal-plan                   family_read
GET    /api/v1/day-brief                   family_read
GET    /api/v1/health                      family_read
POST   /api/v1/health                      family_write
GET    /api/v1/calendar/subscriptions      family_calendar
POST   /api/v1/calendar/subscriptions      family_calendar
```

`PATCH`/`DELETE` auf Termine gilt nur für den lokalen Feed: Einträge aus ICS-Abos
oder fremden CalDAV-Feeds antworten mit 409 — der nächste Sync würde die Änderung
kommentarlos überschreiben. `PATCH /shopping/items/{id}` nimmt `{"checked": true|false}`
als **Zielwert**, kein Toggle — ein Client mit veraltetem Cache darf nichts umkehren.
`GET /meal-plan?year=&week=` liefert die ganze ISO-Woche (Default: aktuelle Woche);
eine Woche ohne Plan ist `entries: []`, kein 404.

## Externe Clients: Bearer, kein CORS

Die Middleware lässt `/api/v1/*` mit `Authorization: Bearer …` bis zum Route-Handler
durch (der Token samt Scopes prüft); ohne Token und ohne Sitzung antwortet die Fläche
mit 401. Die v1-Routen setzen **keine CORS-Header** und beantworten kein `OPTIONS` —
eine Browser-Seite von fremdem Origin kann sie nicht direkt per `fetch` lesen. Ein
Kiosk oder Display holt die Daten deshalb **serverseitig** (eigener kleiner Proxy)
und hält den Token damit zugleich aus dem Browser-JavaScript heraus.

Beispiel:

```bash
curl -H "Authorization: Bearer uwe_…" \
  "http://localhost:3004/api/v1/calendar/events?includeAnniversaries=true"
```

## Personen kommen als Liste

Überall, wo etwas an Personen hängt, heisst das Feld `memberIds` und nimmt mehrere:

| Endpunkt | Feld | Leer heisst |
|---|---|---|
| `POST /api/v1/calendar/events` | `memberIds` | betrifft den ganzen Haushalt |
| `POST /api/v1/health` | `memberIds` | ungültig — 400, mindestens eine Person |
| `POST /api/v1/calendar/subscriptions` | `memberIds` | Abo zeigt den ganzen Haushalt |

Die Antworten führen entsprechend `members: [{ id, displayName }]` statt eines einzelnen
`member`. Das alte Einzelfeld `memberId` wird beim Schreiben weiterhin angenommen und wie
eine einelementige Liste behandelt — ein Bestandsaufrufer bricht also nicht.

Als **Filter** bleibt `?memberId=` einzeln: `GET /api/v1/health?memberId=…` liefert die
ganze Akte einer Person, jetzt einschliesslich der Einträge, die sie mit anderen teilt.

```bash
curl -X POST -H "Authorization: Bearer uwe_…" -H "Content-Type: application/json" \
  -d '{"memberIds":["mem_a","mem_b"],"title":"Wurmkur","kind":"vet","nextDueOn":"2026-11-01"}' \
  "http://localhost:3004/api/v1/health"
```

## Tagesstand für ein Küchen-Tablet

`GET /api/v1/day-brief` liefert in **einem** Aufruf, was heute ansteht: Termine je Person,
Geburtstage, Essensplan, offene Einkaufsliste, fällige Wartungsaufgaben und
Gesundheits-Fälligkeiten. Gedacht für ein Wand- oder Küchendisplay, das nicht fünf
Endpunkte zusammenstückeln soll.

```bash
curl -H "Authorization: Bearer uwe_…" \
  "http://localhost:3004/api/v1/day-brief?days=2"
```

`days=1` ist nur heute, `days=2` (Default) heute und morgen; mehr gibt der Endpunkt nicht
her. `at=<ISO>` verschiebt den Bezugszeitpunkt — nützlich zum Prüfen, ohne die Uhr zu
stellen. Die Antwort trägt `Cache-Control: no-store`: ein Tablet, das den Stand von gestern
zeigt, ist schlimmer als eines, das kurz leer bleibt.

Überfällige Wartungsaufgaben erscheinen am ersten Tag, damit sie nicht aus dem Blick
fallen. Zusammengeführt wird in `packages/family-core/src/day-brief-service.ts`; die Route
selbst enthält keine Logik.

**Es gibt bewusst keinen tokenlosen Weg.** Ein Tagesplan verrät, wer wann nicht zu Hause
ist — anders als beim ICS-Abo (`/api/calendar/feed/[token]`, eigener Token-Typ) gibt
es hier keine Ausnahme von der Bearer-Regel. Ein Display braucht also einen Token mit
`family_read` aus dem Command Center.

## Ein Guard, zwei Aufrufer

`requireFamilyApiAuth` prüft ohne Argumente wie bisher nur die Sitzung; mit `request`
zusätzlich einen API-Token mit den geforderten Scopes.

Der Name ist bewusst derselbe geblieben: `packages/security-tests/src/family-route-inventory.ts`
prüft per Regex, dass **jede** Route unter `apps/family/app/api` genau diesen Guard nennt. Ein
zweiter Guard-Name hätte diese Absicherung für alle neuen Routen ausgehebelt.

Ausnahmen müssen ausdrücklich in `FAMILY_PUBLIC_API_ALLOWLIST` stehen — mit Begründung.

## Was die API nicht hergibt

Private Chats und Dokumente. Dafür gibt es **keinen Endpunkt**, nicht nur kein Tool. Der
Haushalt ist geteilt, aber was hier herauskommt, betrifft Angehörige, auch Kinder.

Konto-Verknüpfungen vergibt die API ebenfalls nicht: wer sich anmelden darf, entscheidet
allein das Häkchen im Command Center.

## MCP-Server

`uwe-family`, Slash-Befehl `/uwefamily`. Sieben lesende Tools; zwei schreibende
(`family_calendar_add_event`, `family_shopping_add`) nur mit `UWE_MCP_ALLOW_WRITES=true`.

```json
{ "uwe-family": { "command": "node",
  "args": ["--env-file-if-exists=.env", "--import", "tsx", "packages/mcp/src/bin/family.ts"] } }
```

Family serviert seine Inhalte selbst, `dataApi` zeigt deshalb auf denselben Origin wie
`primary` — anders als Portal und Brain, die über Studio lesen.

Details: [../engineering/mcp-servers.md](../engineering/mcp-servers.md).
