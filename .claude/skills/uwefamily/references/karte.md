# UWE Family — Bereichskarte

Vollständig generiert aus dem Repo. **Nicht von Hand bearbeiten** —
`pnpm skills:sync` überschreibt den Block, `scripts/area-skills-sync.test.ts`
schlägt fehl, wenn er veraltet ist.

Die Zahlen sind Wegweiser, keine Doku: sie sagen, wo im Bereich Substanz liegt
und ob etwas Neues dazugekommen ist. Für das Warum die `SKILL.md` von /uwefamily.

<!-- uwe:generated:karte start -->
| | |
|---|---|
| App | `apps/family` |
| Port | 3004 |
| Häkchen | `family` |
| Datenbank | uwe-family.db |
| MCP-Server | `uwe-family` |
| Seiten | 23 |
| API-Routen | 37 |

**Seiten-Bereiche** (Top-Level unter `app/`, Zahl = Seiten darunter)

`account` (1) · `briefing` (1) · `calendar` (4) · `chat` (2) · `contracts` (1) · `documents` (1) · `health` (1) · `household` (1) · `kitchen` (6) · `login` (1) · `members` (1) · `scan-inbox` (2)

**API-Bereiche** (Top-Level unter `app/api/`, Zahl = Route-Handler darunter)

`auth` (12) · `calendar` (3) · `dav` (1) · `health` (1) · `kitchen` (2) · `scan` (2) · `v1` (15)

**Server Actions** (`apps/family/app/*-actions.ts`, 11)

`calendar-actions.ts` · `contracts-actions.ts` · `documents-actions.ts` · `family-actions.ts` · `health-actions.ts` · `household-actions.ts` · `kitchen-actions.ts` · `kitchen-bring-actions.ts` · `kitchen-plan-actions.ts` · `member-actions.ts` · `scan-inbox-actions.ts`

**Pakete** (`@uwe/*` aus `apps/family/package.json`, 14)

`@uwe/ai-brain` · `@uwe/assets` · `@uwe/auth` · `@uwe/config` · `@uwe/database` · `@uwe/env` · `@uwe/family-core` · `@uwe/kitchen` · `@uwe/passkeys` · `@uwe/pdf-ocr` · `@uwe/scan-inbox` · `@uwe/security` · `@uwe/shared-ui` · `@uwe/shared-utils`
<!-- uwe:generated:karte end -->
