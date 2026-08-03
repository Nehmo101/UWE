---
name: uwebrain
description: UWE Brain — der owner-private Bereich auf Port 3002. Personal Brain, Daily Admin OS, Today, Capture, Projekte, Werkstatt, Miniaturen, Hardware, Mail, KI-Chat. Nutze das für jede Aufgabe in apps/brain, für owner_private_local-Daten, für strikt lokale Inferenz und für die MCP-Tools brain_*.
---

# UWE Brain

Der private Bereich. Kein geteilter Raum, keine Welten, keine Spieler — ein
Konto sieht das hier, und das ist der Owner. Läuft bewusst auf `127.0.0.1`:
Erreichbarkeit von außen ist eine ausdrückliche Deployment-Entscheidung, kein
Standard (`docs/engineering/brain-local-runtime.md`).

Eigene Datenbank: `uwe-brain.db`. Die Aufteilung kommt aus
`PRISMA_MODEL_BOUNDARIES` (`packages/product-contracts/src/prisma-model-boundaries.ts`),
`scripts/generate-brain-schema-split.mjs` schreibt daraus die Schemata.

## MCP-Tools

<!-- uwe:generated:mcp start -->
6 Tools am MCP-Server `uwe-brain`, davon 3 nur mit Freigabe-Flag.

| Tool | Verfügbar | Zweck |
|------|-----------|-------|
| `brain_health` | immer | Liveness der Brain-App. |
| `brain_stats` | immer | Kennzahlen des Personal Brain: Anzahl Dokumente und Fakten, Verteilung über Kategorien und Fakt-Typen, letzte Aktualisierung. |
| `brain_privacy_status` | immer | Zeigt, ob Personal-Brain-Inhalte für diese MCP-Sitzung freigegeben sind, gegen welche Endpunkte gearbeitet wird und welche Tools dadurch verfügbar sind. |
| `brain_search` | `UWE_MCP_BRAIN_ALLOW_CONTENT` | Semantische bzw. Keyword-Suche über Personal-Brain-Dokumente und -Fakten. |
| `brain_context` | `UWE_MCP_BRAIN_ALLOW_CONTENT` | Baut den Personal-Brain-Prompt-Kontext zu einer Frage — dieselbe Zusammenstellung, die UWE sonst nur an lokale Inferenz gibt. |
| `brain_calendar` | `UWE_MCP_BRAIN_ALLOW_CONTENT` | Kalendereinträge des Daily Admin OS in einem Zeitraum (Sessions, Prep, Persönliches). |

Fehlt ein gegatetes Tool, ist das **kein Fehler** — dann ist das Flag nicht gesetzt.
Das dem Nutzer sagen, statt einen Umweg zu suchen.
<!-- uwe:generated:mcp end -->

**Der wichtigste Satz dieses Skills:** Personal-Brain-Daten sind
`owner_private_local`. UWE routet diesen Kontext sonst ausschließlich an lokale
Inferenz — `assertPersonalBrainLocalOnly`
(`packages/database/src/personal-brain-privacy.ts`) weist Nicht-Lokal-Provider
ausdrücklich ab. Jeder Aufruf eines Inhalts-Tools hier schickt private Daten an
eine Cloud-KI. Entsprechend sparsam und transparent damit umgehen: sagen, was
rausgeht, bevor es rausgeht.

Fehlen `brain_search`, `brain_context` oder `brain_calendar`, ist das **kein
Fehler** — dann ist die Content-Freigabe nicht gesetzt. Das dem Nutzer sagen und
die Frage so weit wie möglich aus den Metadaten beantworten, statt einen Umweg zu
suchen. Nie direkt auf `uwe-brain.db` zugreifen.

## Zugang

`canAccessBrain` (`packages/auth/src/area-access.ts`) — ein Häkchen pro E-Mail,
Owner geht mit durch. Es gibt hier keine Welt-Zuordnung und keine
Sichtbarkeitsstufen: was in Brain liegt, gehört dem Owner.

Daneben steht `User.aiAccess` (`canUseRtxAi`): darf dieses Konto die RTX-KI
benutzen. Einstellbar im Command Center.

## Aufbau

Navigation in `apps/brain/src/navigation/brain-nav.ts`, drei Abschnitte:

| Abschnitt | Seiten |
|---|---|
| Überblick | `/` · `/today` · `/life-brain` · `/ki-chat` · `/capture` |
| Machen | `/projects` · `/workshop` · `/miniatures` |
| Verwaltung | `/hardware` · `/mail` · `/system` |

`/today` ist das Daily Admin OS (`docs/daily-admin-os.md`), `/life-brain` der
persönliche Wissensspeicher, `/capture` der Eingang. Server Actions liegen als
`apps/brain/app/*-actions.ts`.

Getragen von `@uwe/daily-cockpit`, `@uwe/brain-assistant`, `@uwe/host-cockpit`,
`@uwe/mail-core` und `@uwe/ai-brain`. Vollständige Liste: `references/karte.md`.

## Fallen

- **Nie Cloud-Fallback für Personal-Brain-Kontext einbauen.** Der lokale Zwang ist
  keine Policy-Einstellung, sondern hart. DnD-Kontexte dürfen Cloud, dieser nicht.
  Validierung in `packages/ai-brain/src/router/`.
- **Brain-Daten gehören nicht nach Studio oder Family.** Die Modellgrenzen sind in
  `PRISMA_MODEL_BOUNDARIES` festgeschrieben und werden getestet — ein Modell in die
  falsche Datenbank zu legen, bricht `prisma-model-boundaries.sync.test.ts`.
- RTX / Ollama / LM Studio sind LAN-only. Nie hinter Cloudflare Tunnel oder
  öffentliches DNS hängen.
- Drei Datenbanken, drei Migrationsläufe. Für Brain:
  `pnpm --filter @uwe/database db:deploy:brain`.
- Das Brain-Häkchen ist im Seed **nicht** gesetzt — der Seed-Nutzer trägt nur
  `Portal` und `Studio`. Für lokale Brain-Arbeit im Command Center nachsetzen.

## Typische Aufgaben

| Aufgabe | Weg |
|---|---|
| „Läuft Brain, wie ist es konfiguriert?" | `brain_health`, dann `brain_privacy_status` |
| „Wie voll ist mein Brain?" | `brain_stats` — bewusst nur Metadaten: Zähler, Kategorien, Zeitstempel |
| Inhaltliche Frage | Nur mit `UWE_MCP_BRAIN_ALLOW_CONTENT=true`; vorher sagen, dass Inhalte den Host verlassen |
| 401/403 | Token und Häkchen prüfen (Studio → Admin → API-Tokens) |
| Brain alleine starten | `pnpm dev:brain` |

Karte: `references/karte.md` · Depth: `docs/engineering/brain-local-runtime.md`,
`docs/life-brain-privacy.md`, `docs/daily-admin-os.md`,
`docs/engineering/mcp-servers.md`
