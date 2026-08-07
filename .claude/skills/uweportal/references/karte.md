# UWE Portal — Bereichskarte

Vollständig generiert aus dem Repo. **Nicht von Hand bearbeiten** —
`pnpm skills:sync` überschreibt den Block, `scripts/area-skills-sync.test.ts`
schlägt fehl, wenn er veraltet ist.

Die Zahlen sind Wegweiser, keine Doku: sie sagen, wo im Bereich Substanz liegt
und ob etwas Neues dazugekommen ist. Für das Warum die `SKILL.md` von /uweportal.

<!-- uwe:generated:karte start -->
| | |
|---|---|
| App | `apps/portal` |
| Port | 3001 |
| Häkchen | `portal` |
| Datenbank | uwe.db (lesend, über Studio-Guards) |
| MCP-Server | `uwe-portal` |
| Seiten | 27 |
| API-Routen | 28 |

**Seiten-Bereiche** (Top-Level unter `app/`, Zahl = Seiten darunter)

`auth` (21) · `forgot-password` (1) · `login` (1) · `maintenance` (1) · `portal` (1) · `reset-password` (1)

**API-Bereiche** (Top-Level unter `app/api/`, Zahl = Route-Handler darunter)

`admin` (1) · `assets` (1) · `auth` (19) · `health` (3) · `maintenance` (2) · `worlds` (2)

**Server Actions** (`apps/portal/app/*-actions.ts`, 7)

`character-actions.ts` · `character-profile-actions.ts` · `character-sheet-actions.ts` · `note-actions.ts` · `player-hub-actions.ts` · `terra-actions.ts` · `treasury-actions.ts`

**Pakete** (`@uwe/*` aus `apps/portal/package.json`, 12)

`@uwe/assets` · `@uwe/auth` · `@uwe/character-creator` · `@uwe/config` · `@uwe/database` · `@uwe/dnd-api` · `@uwe/env` · `@uwe/passkeys` · `@uwe/player-hub` · `@uwe/security` · `@uwe/shared-ui` · `@uwe/shared-utils`
<!-- uwe:generated:karte end -->
