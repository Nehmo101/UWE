# UWE Brain — Bereichskarte

Vollständig generiert aus dem Repo. **Nicht von Hand bearbeiten** —
`pnpm skills:sync` überschreibt den Block, `scripts/area-skills-sync.test.ts`
schlägt fehl, wenn er veraltet ist.

Die Zahlen sind Wegweiser, keine Doku: sie sagen, wo im Bereich Substanz liegt
und ob etwas Neues dazugekommen ist. Für das Warum die `SKILL.md` von /uwebrain.

<!-- uwe:generated:karte start -->
| | |
|---|---|
| App | `apps/brain` |
| Port | 3002 |
| Häkchen | `brain` |
| Datenbank | uwe-brain.db |
| MCP-Server | `uwe-brain` |
| Seiten | 18 |
| API-Routen | 29 |

**Seiten-Bereiche** (Top-Level unter `app/`, Zahl = Seiten darunter)

`capture` (1) · `hardware` (1) · `ki-chat` (2) · `life-brain` (1) · `login` (1) · `mail` (1) · `miniatures` (1) · `projects` (2) · `system` (1) · `today` (1) · `workshop` (5)

**API-Bereiche** (Top-Level unter `app/api/`, Zahl = Route-Handler darunter)

`ai` (3) · `health` (2) · `life-brain` (1) · `mail` (22) · `workshop` (1)

**Server Actions** (`apps/brain/app/*-actions.ts`, 7)

`assistant-actions.ts` · `brain-actions.ts` · `briefing-actions.ts` · `capture-actions.ts` · `hardware-actions.ts` · `project-actions.ts` · `workshop-actions.ts`

**Pakete** (`@uwe/*` aus `apps/brain/package.json`, 15)

`@uwe/ai-brain` · `@uwe/assets` · `@uwe/auth` · `@uwe/brain-assistant` · `@uwe/calendar` · `@uwe/config` · `@uwe/daily-cockpit` · `@uwe/database` · `@uwe/env` · `@uwe/host-cockpit` · `@uwe/mail` · `@uwe/mail-core` · `@uwe/product-contracts` · `@uwe/security` · `@uwe/shared-ui`
<!-- uwe:generated:karte end -->
