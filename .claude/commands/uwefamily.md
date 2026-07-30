---
description: Direkt mit UWE Family arbeiten (Haushalt, Kalender, Einkauf, Gesundheit)
argument-hint: "[Frage oder Aufgabe]  z. B. /uwefamily was steht diese Woche an?"
---

Arbeite mit der laufenden **UWE Family** über den MCP-Server `uwe-family`.

Aufgabe: $ARGUMENTS

Vorgehen:

1. Falls unklar ist, ob Family läuft: erst `family_health`.
2. Für Personenbezug immer zuerst `family_members` — Termine, Akte und Filter
   arbeiten mit den dortigen Kennungen. Mitglieder ohne Konto (Kleinkind, Gast,
   Haustier) gehören dazu und haben absichtlich kein Login.
3. Termine: `family_calendar_upcoming`. Mit `includeAnniversaries` kommen Geburtstage
   und Jahrestage mit; sie sind keine gespeicherten Termine, sondern werden aufgespannt.
4. Einkauf: `family_shopping_list` ohne `listId` gibt die Übersicht, mit `listId` die
   Positionen. Zwei Schritte, damit ein Blick auf die Listen nicht die Historie zieht.
5. Gesundheit: `family_health_due` für Fälligkeiten, mit `memberId` die ganze Akte
   einer Person — auch die der Katze.
6. Schreibende Tools (`family_calendar_add_event`, `family_shopping_add`) existieren
   **nur** mit `UWE_MCP_ALLOW_WRITES=true`. Fehlen sie, ist das kein Fehler: sag es
   dem Nutzer, statt Umwege zu suchen.
7. Bei 401/403: Token und Scopes prüfen (`family_read`, `family_write`). Nie Guards
   umgehen, nie direkt auf `uwe-family.db` zugreifen.

Wichtig: Family ist geteilt, aber nicht öffentlich. Was hier herauskommt — Termine,
Einkauf, Gesundheitsakte — betrifft Angehörige, auch Kinder. Private Chats und
Dokumente gibt dieser Server bewusst nicht heraus.

Details: `docs/engineering/mcp-servers.md`.
