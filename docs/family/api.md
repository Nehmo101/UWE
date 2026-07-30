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

Token erzeugen: **Studio → Admin → API-Tokens**.

## Endpunkte

```
GET  /api/v1/members                     family_read
POST /api/v1/members                     family_write
GET  /api/v1/calendar/events             family_read
POST /api/v1/calendar/events             family_write
GET  /api/v1/shopping/items              family_read
POST /api/v1/shopping/items              family_write
GET  /api/v1/recipes                     family_read
GET  /api/v1/health                      family_read
POST /api/v1/health                      family_write
GET  /api/v1/calendar/subscriptions      family_calendar
POST /api/v1/calendar/subscriptions      family_calendar
```

Beispiel:

```bash
curl -H "Authorization: Bearer uwe_…" \
  "http://localhost:3004/api/v1/calendar/events?includeAnniversaries=true"
```

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

`uwe-family`, Slash-Befehl `/uwefamily`. Sechs lesende Tools; zwei schreibende
(`family_calendar_add_event`, `family_shopping_add`) nur mit `UWE_MCP_ALLOW_WRITES=true`.

```json
{ "uwe-family": { "command": "node",
  "args": ["--env-file-if-exists=.env", "--import", "tsx", "packages/mcp/src/bin/family.ts"] } }
```

Family serviert seine Inhalte selbst, `dataApi` zeigt deshalb auf denselben Origin wie
`primary` — anders als Portal und Brain, die über Studio lesen.

Details: [../engineering/mcp-servers.md](../engineering/mcp-servers.md).
