---
description: Direkt mit UWE Brain arbeiten (Personal Brain, Daily Admin OS)
argument-hint: "[Frage oder Aufgabe]  z. B. /uwebrain wie voll ist mein Brain?"
---

Arbeite mit dem laufenden **UWE Brain** über den MCP-Server `uwe-brain`.

Aufgabe: $ARGUMENTS

Vorgehen:

1. Falls unklar ist, ob Brain läuft oder wie es konfiguriert ist: erst `brain_health`,
   dann `brain_privacy_status`.
2. Für Umfang, Kategorien und Aktualität: `brain_stats` — liefert bewusst nur Metadaten
   (Zähler, Kategorien, Zeitstempel), keine Titel und keine Inhalte.
3. Inhalts-Tools (`brain_search`, `brain_context`, `brain_calendar`) existieren **nur**, wenn
   `UWE_MCP_BRAIN_ALLOW_CONTENT=true` gesetzt ist. Fehlen sie, ist das kein Fehler:
   sag dem Nutzer, dass die Content-Freigabe nicht gesetzt ist, und beantworte die Frage
   so weit wie möglich aus den Metadaten.
4. Bei 401/403: Token und Rolle prüfen (Studio → Admin → API-Tokens). Nie Guards umgehen,
   nie direkt auf die Brain-Datenbank zugreifen.

Wichtig: Personal-Brain-Daten sind `owner_private_local`. UWE routet diesen Kontext sonst
ausschließlich an lokale Inferenz (`assertPersonalBrainLocalOnly`). Jeder Inhalts-Aufruf hier
schickt private Daten an eine Cloud-AI — entsprechend sparsam und transparent damit umgehen.

Details: `docs/engineering/mcp-servers.md`.
