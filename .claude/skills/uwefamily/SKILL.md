---
name: uwefamily
description: UWE Family — der gemeinsame Haushalt auf Port 3004. Mitglieder, Kalender, Küche und Rezepte, Einkaufsliste, Gesundheitsakte, Verträge, Dokumente, Scan-Eingang, Tagesstand. Nutze das für jede Aufgabe in apps/family, für die Family-API v1 und für die MCP-Tools family_*.
---

# UWE Family

Der geteilte Haushaltsbereich. **Keine Welten, keine Rollen, keine Sichtbarkeits-
stufen** — wer das Häkchen `Family` trägt, sieht alles. Das ist bewusst so und
darf nicht durch Feinabstufungen ersetzt werden.

Eigene Datenbank `uwe-family.db`, eigene Privacy-Klasse `family_shared`: lokal wie
`owner_private_local`, aber geteilt. Verlässt den Host genauso wenig
(`packages/product-contracts/src/domain-boundaries.ts`).

## MCP-Tools

<!-- uwe:generated:mcp start -->
9 Tools am MCP-Server `uwe-family`, davon 2 nur mit Freigabe-Flag.

| Tool | Verfügbar | Zweck |
|------|-----------|-------|
| `family_health` | immer | Liveness der Family-App. |
| `family_members` | immer | Wer zum Haushalt gehört: Name, Art (Erwachsen, Kind, Haustier, Gast), Farbe, Geburtstag. |
| `family_calendar_upcoming` | immer | Termine des Haushalts in einem Zeitraum, mit den beteiligten Personen. |
| `family_shopping_list` | immer | Ohne `listId` die Übersicht der Einkaufslisten, mit `listId` deren Positionen. |
| `family_recipes` | immer | Rezepte des Haushalts mit Titel, Dauer, Portionen und Bewertung. |
| `family_day_brief` | immer | Was heute (und optional morgen) im Haushalt ansteht, in einem Aufruf: Termine je Person, Geburtstage, Essensplan, offene Einkaufsliste, fällige Wartungsaufgaben und … |
| `family_health_due` | immer | Was in der Gesundheits- und Tierarzt-Akte demnächst fällig wird (Impfungen, Vorsorge, Medikamente) — für Menschen und Tiere. |
| `family_calendar_add_event` | `UWE_MCP_ALLOW_WRITES` | Legt einen Termin im Haushalts-Kalender an. |
| `family_shopping_add` | `UWE_MCP_ALLOW_WRITES` | Setzt eine Position auf die Einkaufsliste. |

Fehlt ein gegatetes Tool, ist das **kein Fehler** — dann ist das Flag nicht gesetzt.
Das dem Nutzer sagen, statt einen Umweg zu suchen.
<!-- uwe:generated:mcp end -->

Scopes: `family_read` fürs Lesen, `family_write` fürs Schreiben, `family_calendar`
für Feeds (`packages/database/src/api-token-service.ts`). Bei 401/403 Token und
Scopes prüfen, nie an den Guards vorbei und nie direkt auf `uwe-family.db`.

Was dieser Server **bewusst nicht** herausgibt: private Chats und Dokumente. Dafür
gibt es keinen Endpunkt, nicht nur kein Tool.

## Was hier anders ist als überall sonst

- **Mitglieder können ohne Konto existieren** — Kleinkind, Gast, Haustier. Die
  haben absichtlich kein Login. Bei jedem Personenbezug zuerst `family_members`,
  denn Termine, Akte und Filter arbeiten mit den dortigen Kennungen.
- **Wo ein Mitglied hinterlegt wird, dürfen es mehrere sein.** Termin,
  Akten-Eintrag und Kalender-Abo hängen alle an einer eigenen
  Verknüpfungstabelle, nie an einer `member_id`-Spalte; im Schreib-Weg heisst
  das Feld überall `memberIds`, in der Antwort `members`. Ohne Zuordnung
  betrifft ein Termin den ganzen Haushalt und ein Abo zeigt ihn ganz — ein
  Akten-Eintrag ohne Person wird abgelehnt. Gesetzt wird überall über
  `setMemberLinks` (`packages/family-core/src/member-links.ts`), in der
  Oberfläche über die Kästchenliste `MemberChecklist`.
- **Ein Termin ohne eigenes Ende dauert eine Stunde.** `resolveEventEnd`
  (`packages/family-core/src/event-duration.ts`) belegt vor — im Formular, über
  `POST /api/v1/calendar/events`, über `family_calendar_add_event` und beim
  ICS-Import gleichermaßen. Ein angegebenes Ende bleibt stehen, ganztägig bleibt
  ohne Ende, und Nacharbeiten geht immer. Fremde Feeds fasst die Regel nicht an.
- **Import und Abo sind zwei Wege, keine Varianten.** `/calendar/import` liest
  eine `.ics`-**Datei** einmalig ein: die Termine gehören danach dem Haushalt
  (lokaler Feed, `kind: personal`, wiedererkannt an `externalUid` mit Präfix
  `ics-import:`). `/calendar/feeds` abonniert eine **Adresse**, die fremd und
  schreibgeschützt bleibt. Erst Vorschau, dann Übernahme — nie automatisch.
  Serien werden nicht aufgespannt, nur der erste Termin kommt mit.
- **Geburtstage und Jahrestage sind keine gespeicherten Termine.**
  `family_calendar_upcoming` spannt sie mit `includeAnniversaries` auf.
- **Zwei Wege aufs iPhone:** das ICS-Abo (`uwecal_`, nur lesen, inkl. Geburtstage
  und Akte) und der CalDAV-Account (`uwedav_`, lesen und schreiben, nur der
  lokale Feed). Der CalDAV-Server lebt in
  `packages/family-core/src/caldav-server.ts`; PROPFIND/REPORT erreichen Next
  nur über den DAV-Proxy (`deploy/scripts/uwe-dav-proxy.mjs`), der sie als
  POST + `x-uwe-dav-method` an `apps/family/app/api/dav/[[...segments]]/route.ts`
  weiterreicht. Details: `docs/family/kalender.md`.
- **Die Gesundheitsakte gilt auch für Tiere** — `family_health_due` liefert
  Impfungen und Vorsorge für Menschen und Katze gleichermaßen; ein Eintrag darf
  auf mehrere lauten (Wurmkur für beide Katzen).
- **Akteneinträge sind keine gespeicherten Termine, stehen aber im Kalender.**
  `expandHealthOccurrences` spannt sie wie Geburtstage für den Zeitraum auf:
  `nextDueOn` als „… fällig", `occurredOn` als Notiz. Geändert wird nur in der
  Akte; das ICS-Abo bekommt weiterhin nur die Fälligkeiten.
- **`family_shopping_list` ist zweistufig:** ohne `listId` die Übersicht, mit
  `listId` die Positionen. So zieht ein Blick auf die Listen nicht die Historie.
- **Der Wocheneinkauf hat zwei Abschnitte** (`ShoppingListItem.trip`):
  Großeinkauf und Frische-Einkauf. Verderbliches (Obst & Gemüse, Kühlregal), das
  erst ab dem Frische-Tag (Default Donnerstag) gebraucht wird, wandert in den
  zweiten Abschnitt — deterministisch, `packages/kitchen/src/shopping-split.ts`.
- **Der KI-Wochenvorschlag ist Maschinenraum-lokal und nie Auto-Apply.** Kontext:
  Rezepte samt Zutaten, Koch-Historie (12 Wochen), Vorrat mit Ablauf. Erfundene
  Gerichte (`invented`) lassen sich als Rezept-Entwurf übernehmen. Der Button
  verlangt das KI-Flag (`requireFamilyAiActionAuth`), Modell aus dem
  `chat`-Workflow-Slot.
- **Kassenbons wandern in den Vorrat:** `parseReceiptText` extrahiert Positionen,
  Ablageziel „In den Vorrat" legt nach Bestätigung `PantryItem`s an — nie
  automatisch.
- **Family ist als PWA installierbar** (`apps/family/app/manifest.ts`); das
  Manifest ist von der Middleware ausgenommen (credential-loser Fetch). Kein
  Service Worker — offline kann nur die Einkaufsliste (`FamilyShoppingOffline`).

## Aufbau

Navigation in `apps/family/src/navigation/family-nav.ts`, vier Abschnitte:

| Abschnitt | Seiten |
|---|---|
| Überblick | `/` · `/briefing` · `/chat` · `/chat/privat` |
| Haushalt | `/contracts` · `/documents` · `/calendar` (+ `/feeds`, `/import`, `/abo`) |
| Alltag | `/kitchen` · `/household` · `/scan-inbox` |
| Verwaltung | `/members` · `/health` · `/account` |

**Family-API v1** unter `apps/family/app/api/v1/`: `members`, `calendar`,
`shopping`, `recipes`, `meal-plan`, `health`, `day-brief`. Das ist die
token-authentifizierte Außenseite, die auch der MCP-Server benutzt — dokumentiert
in `docs/family/api.md`. Schreiben können externe Clients inzwischen mehr als
Anlegen: Einkaufspositionen abhaken (`PATCH shopping/items/{id}`, Zielwert statt
Toggle) und lokale Termine ändern/löschen (`PATCH`/`DELETE calendar/events/{id}`;
Abo-/CalDAV-Termine antworten mit 409). Die Middleware lässt `/api/v1/*` mit
Bearer-Header durch — CORS gibt es keins, ein Kiosk proxied serverseitig.

**Tagesstand** (`/briefing`, `family_day_brief`): fasst Termine je Person,
Geburtstage, Essensplan, offene Einkaufsliste und fällige Wartungsaufgaben in einem
Aufruf zusammen. Logik in `packages/family-core/src/day-brief-service.ts`, geladen
über `briefing-loader.ts`.

Fachlogik liegt in `@uwe/family-core`, `@uwe/kitchen` und `@uwe/scan-inbox` —
nicht in den Route Handlers.

## Fallen

- **Der Haushalt betrifft Angehörige, auch Kinder.** Was hier herauskommt, ist
  echter Alltag realer Menschen. Nicht ungefragt weiterreichen, nicht in Exporte
  oder Zusammenfassungen mischen, die woanders landen.
- Family-Modelle gehören in `uwe-family.db`. `FAMILY_ONLY_DATA_DOMAINS` und
  `PRISMA_MODEL_BOUNDARIES` legen das fest; `prisma-model-boundaries.sync.test.ts`
  prüft es.
- Migrationen laufen getrennt: `pnpm --filter @uwe/database db:deploy:family`.
- Das Family-Häkchen ist im Seed **nicht** gesetzt — im Command Center nachsetzen.
- Kein Cross-App-Import; `apps/family` steht für sich.

## Typische Aufgaben

| Aufgabe | Weg |
|---|---|
| „Was steht heute an?" | `family_day_brief` — ein Aufruf statt vier |
| „Was steht diese Woche an?" | `family_members`, dann `family_calendar_upcoming` mit `includeAnniversaries`, dazu `family_health_due` |
| Einkauf | `family_shopping_list` ohne `listId`, dann mit |
| Essensplanung | `family_recipes` gegen `family_shopping_list` abgleichen; Wochenplan/KI/Einkaufs-Split: `docs/family/essensplan.md` |
| Ganze Akte einer Person | `family_health_due` mit `memberId` — auch geteilte Einträge |
| Termin anlegen | `family_calendar_add_event` — nur mit `UWE_MCP_ALLOW_WRITES=true` |
| ICS-Datei einlesen | `/calendar/import` in der App; Fachlogik `@uwe/family-core` → `ics-import.ts` |
| Family alleine starten | `pnpm dev:family` |

Karte: `references/karte.md` · Depth: `docs/family/README.md`, `docs/family/api.md`,
`docs/family/mitglieder.md`, `docs/family/kalender.md`, `docs/family/kochbuch.md`,
`docs/family/essensplan.md`, `docs/engineering/mcp-servers.md`
