---
description: Direkt mit UWE Studio arbeiten (Welten, Brain, Jobs, Admin)
argument-hint: "[Frage oder Aufgabe]  z. B. /uwestudio status von aventurien"
---

Arbeite mit der laufenden **UWE Studio**-Instanz über den MCP-Server `uwe-studio`.

Aufgabe: $ARGUMENTS

Vorgehen:

1. Bei Betriebsfragen ("läuft alles?", "warum ist X kaputt?"): `studio_health`, danach
   `studio_admin_status` (braucht Scope `admin_read`) und bei Sicherheitsfragen `studio_audit_log`.
2. Beim Suchen von Inhalten: `studio_search` (mind. 2 Zeichen) — deckt Wiki-Seiten und
   Admin-Objekte ab und liefert direkte Studio-Links.
3. Für eine konkrete Welt: `studio_world_brain` (Dokumente, Fakten, Zusammenfassung) und
   `studio_world_graph` (Struktur). `accessContext=portal` bzw. `preview=true` zeigt die
   Spielersicht.
4. Für DnD-Referenzen: `studio_dnd_spell_search`, `studio_dnd_equipment_search`.
5. Schreibende Tools (`studio_create_brain_entry`, `studio_enqueue_job`) existieren nur mit
   `UWE_MCP_ALLOW_WRITES=true`. Fehlen sie, nicht improvisieren — den Nutzer darauf hinweisen.

Wichtig: Studio zeigt bewusst auch `dm_only`-Inhalte. Diese dürfen niemals in Portal-Ausgaben,
Exporte oder spielerseitige Texte übernommen werden. Bei 401/403 zuerst Token, Rolle und
Scopes prüfen, statt an den Guards vorbeizuarbeiten.

Details: `docs/engineering/mcp-servers.md`.
