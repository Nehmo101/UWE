# UWE Roadmap — Was fehlt / ist noch nicht reif

Stand: 2026-06-29 · ergänzt durch Security-/Orchestrator-Audit.

Diese Datei ist die **Source of Truth** für geplante, aber noch nicht produktionsreife Bereiche. Implementierter Code mit Phase-1-Scaffolding verweist hierher.

---

## Auth & Security

| Thema | Status | Nächste Schritte |
|-------|--------|------------------|
| Studio/Portal Session-Login | ✅ Implementiert | `AUTH_REQUIRED=true` in Produktion |
| Session-Token-Hashing at rest | ✅ `token_hash` Spalte + SHA-256 | Migration invalidiert Sessions |
| Setup POST Rate-Limit | ✅ Implementiert | — |
| Setup GET Leak | ✅ Kein `setupConfigured` nach Abschluss | — |
| 2FA (TOTP) | ✅ Login + Account-UI (`/account/security`) | — |
| E2E-Tests (Login, Setup, Reset, Logout) | ✅ Studio + Portal Playwright | Setup-Flow (unseeded DB) optional erweitern |
| Multi-Instance Rate-Limit | ✅ File-backed + optional Redis (`UWE_REDIS_URL`) | Distributed Session Store bei horizontaler Skalierung |
| Distributed Session Store | 🔲 SQLite only | Optional bei horizontaler Skalierung |

---

## Datenbank

| Thema | Status | Nächste Schritte |
|-------|--------|------------------|
| SQLite / libsql (Prod) | ✅ Aktuell | Breaking Migrations erlaubt — manuelles Neupflegen |
| PostgreSQL | ✅ Baseline + dual-client | `db:deploy:postgres`, siehe `docs/postgresql.md` |

---

## Backup & Restore

| Thema | Status | Nächste Schritte |
|-------|--------|------------------|
| Welten, Seiten, Assets, Labels | ✅ | — |
| Users/Memberships/Unlocks | ✅ Restore + Passwort-Setup | `/forgot-password` oder Restore-Option „Setup-Mails senden“ |
| PageTemplates (custom) | ✅ Full-Backup | — |
| ShareLinks | ✅ Export ohne Token; Restore regeneriert Token | Passwörter müssen neu gesetzt werden |
| PlayerNotes | ✅ Opt-in (`includePlayerNotes`) | Datenschutz beachten |

---

## Export

| Thema | Status | Nächste Schritte |
|-------|--------|------------------|
| Static HTML Export | ✅ | `pnpm export:static` |
| Markdown/HTML Wiki-Export | ✅ `pnpm export:wiki` | DM-Kontext (`--context dm`), Asset-Links |
| PDF Label Export | ✅ Phase 1 | Siehe `docs/LABELS.md` |

---

## Feature-Bereiche (Phase 1 → Phase 2)

### Hard UI/UX Reset (Shells + Nav-Vertrag)

| Wave | Status |
|------|--------|
| Wave 0 — Zentraler Nav-Vertrag, UI-Stack (Tailwind v4 + shadcn), AppShell | ✅ done |
| Wave 1 — StudioShell/WorldShell/SystemShell/PortalShell, QF10 Label-Druck, Portal | ✅ done |
| Wave 2 — ConnectorShell mit connector-nav IA, QF10 Drucker-Doku | ✅ done |
| Wave 2 open — Restliche Welt-Routen auf WorldShell, Wiki-Edit auf WorldShell | 🔲 open |

Shells-Nav-Vertrag: `@uwe/shared-utils/navigation` — alle drei Apps (Studio, Portal, RTX Connector) nutzen denselben Typ.

### Image Studio (`docs/IMAGE_STUDIO.md`)

| Phase 1 | Phase 2 TODO |
|---------|--------------|
| `/image-studio`, Job-Queue, RTX/Cloud-Routing | ✅ Inpaint-UI, Varianten-Batch, Seiten-Link |

### Kalender (`docs/CALENDAR_INTEGRATION.md`)

| Phase 1 | Phase 2 TODO |
|---------|--------------|
| `/calendar`, iCal-Import, FamilyWall read-only | ✅ Feed-Passwort, Zwei-Wege-Sync, Wochenansicht |

### DnD API (`docs/DND_API_INTEGRATION.md`)

| Phase 1 | Phase 2 TODO |
|---------|--------------|
| Package `@uwe/dnd-api`, dm_only | ✅ Statblock-Import, Encounter-Builder |

### Agent Jobs (`docs/AGENT_JOBS.md`)

| Phase 1 | Phase 2 TODO |
|---------|--------------|
| Admin-UI, Job-Queue, GitHub Workflow | ✅ Retry + GitHub-Status-Polling |

---

## Daily Admin OS

Siehe `docs/daily-admin-os.md` — Cockpit-Module teils UI-only, Brain/Mail teils Phase 2.

---

## Tests & QA

- **Automatisiert:** `pnpm test:security`, `pnpm test:auth`, `pnpm test:e2e` (Studio Login), `docs/SECURITY_QA_MATRIX.md`
- **Manuell:** `docs/TEST_PLAN.md` vor jedem Release
- **E2E:** Playwright-Baseline im CI (`e2e`-Job); erweiterte Flows weiter manuell

---

## Verwandte Dokumente

- [SECURITY.md](../SECURITY.md) — Self-Hosting Checklist
- [docs/REPO_AUDIT.md](./REPO_AUDIT.md) — Architektur-Inventar
- [CHANGELOG.md](../CHANGELOG.md) — Release-Historie
