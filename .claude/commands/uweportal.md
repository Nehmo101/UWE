---
description: Spielersicht des UWE Portals prüfen (inkl. dm_only-Leak-Check)
argument-hint: "[Welt-Slug oder Frage]  z. B. /uweportal aventurien"
---

Arbeite mit dem **UWE Portal** über den MCP-Server `uwe-portal`.

Aufgabe: $ARGUMENTS

Vorgehen:

1. Betrieb: `portal_health` (läuft das Portal?) und `portal_maintenance_status`
   (sehen Spieler gerade die Wartungsseite?).
2. Bei jeder Frage zu einer Welt zuerst `portal_leak_check` ausführen. Das Tool vergleicht
   DM-Sicht und Spielersicht und meldet jeden `dm_only`-Eintrag, der in der Spielersicht
   auftaucht. **Ein Treffer ist ein Sicherheitsbefund** — sofort melden, Ursache in
   `packages/database/src/permissions.ts` bzw. der Sichtbarkeit des Eintrags suchen.
3. Für "was sieht ein Spieler wirklich?": `portal_player_view_brain` und
   `portal_player_view_graph`. Beide lesen über Studio mit `accessContext=portal` bzw.
   `preview=player` und durchlaufen dieselbe Filterung wie das Portal.
4. Bei Verbindungs- oder Token-Problemen: `portal_config` zeigt die genutzten Endpunkte.

Wichtig: Der Portal-MCP ist rein lesend. Portal-Inhalte werden ausschließlich in Studio
gepflegt — für Änderungen `/uwestudio` verwenden.

Details: `docs/engineering/mcp-servers.md`.
