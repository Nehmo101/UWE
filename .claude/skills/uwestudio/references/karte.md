# UWE Studio — Bereichskarte

Vollständig generiert aus dem Repo. **Nicht von Hand bearbeiten** —
`pnpm skills:sync` überschreibt den Block, `scripts/area-skills-sync.test.ts`
schlägt fehl, wenn er veraltet ist.

Die Zahlen sind Wegweiser, keine Doku: sie sagen, wo im Bereich Substanz liegt
und ob etwas Neues dazugekommen ist. Für das Warum die `SKILL.md` von /uwestudio.

<!-- uwe:generated:karte start -->
| | |
|---|---|
| App | `apps/studio` |
| Port | 3000 |
| Häkchen | `studio` |
| Datenbank | uwe.db |
| MCP-Server | `uwe-studio` |
| Seiten | 97 |
| API-Routen | 147 |

**Seiten-Bereiche** (Top-Level unter `app/`, Zahl = Seiten darunter)

`account` (2) · `admin` (4) · `ai` (1) · `brain` (1) · `bugs` (1) · `command` (1) · `continue` (1) · `forgot-password` (1) · `ideas` (1) · `image-studio` (3) · `import` (1) · `jobs` (1) · `knowledge` (1) · `login` (1) · `logout` (1) · `mail` (1) · `maintenance` (1) · `portal` (1) · `prompts` (2) · `reset-password` (1) · `search` (1) · `settings` (1) · `studio` (1) · `templates` (3) · `worlds` (63)

**API-Bereiche** (Top-Level unter `app/api/`, Zahl = Route-Handler darunter)

`admin` (25) · `ai` (12) · `assets` (1) · `auth` (22) · `backup` (5) · `brain` (4) · `bugs` (2) · `calendar` (2) · `command` (1) · `connectors` (9) · `dnd` (3) · `dnd-api` (1) · `dnd-generator` (1) · `documents` (1) · `export` (1) · `health` (3) · `ideas` (4) · `image-studio` (1) · `import` (5) · `inference` (5) · `internal` (2) · `jobs` (2) · `mail` (2) · `maintenance` (2) · `research` (2) · `settings` (1) · `spotify` (1) · `tags` (1) · `worlds` (26)

**Server Actions** (`apps/studio/app/*-actions.ts`, 32)

`asset-actions.ts` · `brain-actions.ts` · `bug-actions.ts` · `campaign-actions.ts` · `custom-theme-actions.ts` · `design-assistant-actions.ts` · `dungeon-actions.ts` · `ideas-actions.ts` · `import-campaign-actions.ts` · `import-campaign-chat-actions.ts` · `import-central-actions.ts` · `import-doc-actions.ts` · `inspector-actions.ts` · `integration-actions.ts` · `kampagnen-actions.ts` · `label-actions.ts` · `label-print-actions.ts` · `life-admin-actions.ts` · `magic-item-actions.ts` · `note-actions.ts` · `page-bulk-actions.ts` · `page-transfer-actions.ts` · `print-list-actions.ts` · `prompt-actions.ts` · `session-actions.ts` · `session-live-actions.ts` · `settings-actions.ts` · `soundboard-actions.ts` · `template-actions.ts` · `terra-actions.ts` · `theme-actions.ts` · `world-calendar-actions.ts`

**Pakete** (`@uwe/*` aus `apps/studio/package.json`, 31)

`@uwe/ai-brain` · `@uwe/assets` · `@uwe/auth` · `@uwe/backup` · `@uwe/calendar` · `@uwe/campaign-cockpit` · `@uwe/config` · `@uwe/connector` · `@uwe/cookbook` · `@uwe/daily-cockpit` · `@uwe/database` · `@uwe/dnd-api` · `@uwe/doc-import` · `@uwe/env` · `@uwe/github-issues` · `@uwe/host-cockpit` · `@uwe/image-studio` · `@uwe/knoteforge-import` · `@uwe/mail` · `@uwe/passkeys` · `@uwe/pdf-campaign-import` · `@uwe/pdf-ocr` · `@uwe/player-hub` · `@uwe/roll-tables` · `@uwe/security` · `@uwe/session-runner` · `@uwe/shared-ui` · `@uwe/shared-utils` · `@uwe/soundboard` · `@uwe/static-export` · `@uwe/web-search`
<!-- uwe:generated:karte end -->
