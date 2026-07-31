# MCP-Server für UWE

UWE stellt seine vier Produkte als **MCP-Server** (Model Context Protocol) bereit, damit ein
Agent wie Claude Code direkt mit der laufenden Instanz arbeiten kann — statt sich durch den
Quellcode zu raten.

| Server | Produkt | Slash-Command | Zweck |
|--------|---------|---------------|-------|
| `uwe-studio` | DM-App (Port 3000) | `/uwestudio` | Welten, Brain, Jobs, Health, Admin |
| `uwe-portal` | Spieler-Wiki (Port 3001) | `/uweportal` | Spielersicht einer zugeordneten Welt prüfen |
| `uwe-brain` | Owner-Bereich (Port 3002) | `/uwebrain` | Personal Brain, Daily Admin OS — privacy-gated |
| `uwe-family` | Haushalt (Port 3004) | `/uwefamily` | Mitglieder, Kalender, Einkauf, Rezepte, Gesundheitsakte |

Code: `packages/mcp`. Registrierung: `.mcp.json` im Repo-Root.

## Warum vier Server statt einem

Das Repo erzwingt den Produkt-Split hart (`@uwe/product-contracts` → `APP_AUDIENCE`,
`scripts/product-boundary-check.mjs`). Vier Server spiegeln diese Grenze — und, wichtiger:
**Brain und Family lassen sich einzeln weglassen.** Wer Studio und Portal an einen Agenten
hängen will, muss weder den owner-privaten Bereich noch den Haushalt mitliefern.

## Warum HTTP statt Direktzugriff

Die Server sind dünne HTTP-Clients vor der laufenden App. Sie importieren **nicht**
`@uwe/database` und sprechen die SQLite-Dateien nicht direkt an. Damit bleibt jeder Request
auf dem normalen Pfad:

- `guardStudioApiRequest` / `requireAdminApiAuth` prüfen Zugang und Token-Scopes,
- `packages/database/src/permissions.ts` filtert Sichtbarkeiten,
- Audit-Log-Einträge entstehen wie bei jedem anderen Client.

Ein Direktzugriff auf die DB würde all das umgehen — genau die Invarianten, die UWE ausmachen.
Nebeneffekt: Die Server funktionieren unverändert gegen eine entfernte Instanz hinter
Cloudflare Tunnel.

Der Preis: Ein Tool kann nur, was eine Route hergibt. Es gibt z. B. kein `list_worlds`, weil
Studios `/api/worlds` nur `POST` kennt — `studio_search` ist der Weg dorthin.

## Slash-Commands vs. MCP

Ein MCP-Server liefert **Tools**; seine Prompts erscheinen in Claude Code als
`/mcp__uwe-brain__<prompt>`. Ein kurzes `/uwebrain` entsteht dadurch **nicht** von selbst.
Deshalb liegen in `.claude/commands/` vier dünne Slash-Commands (`uwebrain.md`, `uwestudio.md`,
`uweportal.md`, `uwefamily.md`), die den passenden Server ansteuern und die Reihenfolge der
Tool-Aufrufe vorgeben. Der MCP-Server ist die Fähigkeit, der Slash-Command der Einstieg.

## Konfiguration

Die Server lesen beim Start `.env` im Repo-Root (`node --env-file-if-exists=.env`), erben also
`STUDIO_API_TOKEN`, `NEXT_PUBLIC_STUDIO_URL` und Co. automatisch. Alles ist per Umgebung
überschreibbar:

| Variable | Default | Wirkung |
|----------|---------|---------|
| `UWE_STUDIO_URL` | `http://127.0.0.1:3000` | Studio-Origin (Fallback: `NEXT_PUBLIC_STUDIO_URL`) |
| `UWE_PORTAL_URL` | `http://127.0.0.1:3001` | Portal-Origin |
| `UWE_BRAIN_URL` | `http://127.0.0.1:3002` | Brain-App-Origin (nur Health) |
| `UWE_FAMILY_URL` | `http://127.0.0.1:3004` | Family-Origin (Fallback: `NEXT_PUBLIC_FAMILY_URL`) |
| `UWE_FAMILY_TOKEN` | – | API-Token für Family (Fallback: `UWE_MCP_TOKEN`) |
| `UWE_STUDIO_TOKEN` | – | API-Token für Studio (Fallback: `UWE_MCP_TOKEN`, `STUDIO_API_TOKEN`) |
| `UWE_MCP_TOKEN` | – | Gemeinsamer Token für alle Server |
| `UWE_MCP_ALLOW_WRITES` | `false` | Registriert schreibende Tools (nur `true` zählt) |
| `UWE_MCP_BRAIN_ALLOW_CONTENT` | `false` | Gibt Personal-Brain-**Inhalte** frei |
| `UWE_MCP_TIMEOUT_MS` | `20000` | HTTP-Timeout je Tool-Aufruf |
| `UWE_MCP_MAX_RESPONSE_CHARS` | `20000` | Kürzungsgrenze für Tool-Ausgaben |

Token erzeugen: **Studio → Admin → API-Tokens**. Die Scopes des Tokens entscheiden, was
erreichbar ist — `studio_admin_status` und `studio_audit_log` brauchen `admin_read`.

## Privacy-Gate für Brain

CLAUDE.md fordert „Cloud-AI ohne Kampagnen/Brain-Kontext", und `assertPersonalBrainLocalOnly`
setzt das durch: Personal-Brain-Kontext geht sonst ausschließlich an lokale Inferenz. Ein
MCP-Client wie Claude Code **ist** Cloud-AI. Deshalb hat `uwe-brain` zwei Stufen:

- **Default** — `brain_health`, `brain_stats`, `brain_privacy_status`. `brain_stats` wertet
  clientseitig aus und gibt ausschließlich Zähler, Kategorienamen und Zeitstempel zurück:
  keine Titel, keine Inhalte.
- **`UWE_MCP_BRAIN_ALLOW_CONTENT=true`** — zusätzlich `brain_search`, `brain_context`,
  `brain_calendar`. Ab hier verlassen private Inhalte den Host.

Die Freigabe ist bewusst eine Umgebungsvariable und kein Tool-Argument: Sie ist eine
Entscheidung des Betreibers pro Sitzung, nicht des Modells zur Laufzeit.

## Family: geteilt, aber nicht öffentlich

Family serviert seine Inhalte selbst unter `/api/v1/*` — `dataApi` zeigt deshalb auf denselben
Origin wie `primary`, anders als bei Portal und Brain, die über Studio lesen.

Zwei Dinge unterscheiden diesen Katalog von den anderen:

- **Kein Welt-Begriff, keine Rollen.** Wer das Häkchen `Family` trägt, sieht alles. Ein
  API-Token braucht `family_read` zum Lesen und `family_write` zum Schreiben; die Abos des
  Kalender-Feeds hängen an `family_calendar`.
- **Der Haushalt betrifft Angehörige, auch Kinder.** Termine, Einkaufsliste und
  Gesundheitsakte kommen heraus — private Chats und Dokumente bewusst nicht. Dafür gibt es
  keinen Endpunkt, nicht nur kein Tool.

Mitglieder können ohne Konto existieren (Kleinkind, Gast, Haustier). Termine gehören keiner,
einer oder mehreren Personen; ohne Zuordnung betreffen sie den ganzen Haushalt. Geburtstage
und Jahrestage sind keine gespeicherten Termine — `family_calendar_upcoming` spannt sie mit
`includeAnniversaries` auf.

## Die Spielersicht

Der eigene Portal-Server existiert, damit „was sieht ein Spieler?" beantwortbar bleibt, ohne
sich im Studio anzumelden. Der frühere `portal_leak_check` ist entfallen: Er verglich die
DM-Sicht mit der Spielersicht auf `dm_only`-Einträge, und Sichtbarkeit pro Eintrag gibt es
nicht mehr. Es gilt eine Regel — wer der Welt zugeordnet ist, sieht alles darin.

Portal-eigene Inhaltsrouten sind session-cookie-only, deshalb lesen die Spielersicht-Tools über
Studio mit `accessContext=portal` bzw. `preview=player`. Das ist derselbe Pfad, den auch das
Portal fährt.

## Betrieb

```bash
# Voraussetzung: die jeweilige App läuft (pnpm dev:studio / dev:portal / dev:brain / dev:family)
pnpm mcp:studio     # stdio-Server, spricht JSON-RPC — nicht interaktiv gedacht
pnpm mcp:portal
pnpm mcp:brain
```

In Claude Code werden die Server über `.mcp.json` automatisch gefunden; `/mcp` zeigt den Status.

Smoke-Test von Hand:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node --env-file-if-exists=.env --import tsx packages/mcp/src/bin/studio.ts
```

## Protokoll ohne SDK

`packages/mcp/src/protocol` implementiert MCP direkt: JSON-RPC 2.0 als newline-getrennte
Frames über stdio, dazu `initialize`, `tools/list`, `tools/call`, `prompts/list`, `prompts/get`
und `ping`. Verhandelte Revisionen stehen in `SUPPORTED_PROTOCOL_VERSIONS`.

Das spart eine Laufzeit-Abhängigkeit (relevant für `pnpm audit:prod` und einen Host, der
offline laufen können muss) und hält die Fläche testbar: `handleMessage` ist bezüglich IO rein.

**Invariante:** stdout trägt ausschließlich Protokoll-Frames. Jede Diagnose geht über
`logDiagnostic` nach stderr — ein einzelnes `console.log` zerstört den Stream.

## Neues Tool hinzufügen

1. Prüfen, ob eine Route existiert, die das kann. Falls nicht: erst die Route in der App bauen
   (mit Guard), nicht am MCP-Server vorbei.
2. In `packages/mcp/src/tools/<surface>.ts` mit `httpTool(...)` registrieren; Beschreibung so
   schreiben, dass ein Modell ohne Repo-Kenntnis erkennt, wann das Tool passt.
3. Schreibende Tools gehören in `writeTools(...)` — sie erscheinen nur mit
   `UWE_MCP_ALLOW_WRITES=true`.
4. Test in `packages/mcp/src/tools/tools.test.ts` ergänzen: Gating und Ausgabeform.

Verwandt: [AGENTS.md](../../AGENTS.md), [self-service-config.md](self-service-config.md),
[../ARCHITECTURE.md](../ARCHITECTURE.md).
