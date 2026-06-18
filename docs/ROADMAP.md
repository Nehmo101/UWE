# UWE Roadmap — Was fehlt / ist noch nicht reif

Stand: 2026-06-18 · ergänzt durch Security-/Orchestrator-Audit.

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
| E2E-Tests (Login, Setup, Reset, Logout) | ✅ Playwright-Baseline (`pnpm test:e2e`) | Portal-E2E, Setup/Reset-Flows erweitern |
| Multi-Instance Rate-Limit | ✅ `UWE_RATE_LIMIT_DIR` (file-backed) | Redis via `setRateLimitStore()` optional |
| Distributed Session Store | 🔲 SQLite only | Optional bei horizontaler Skalierung |

---

## Datenbank

| Thema | Status | Nächste Schritte |
|-------|--------|------------------|
| SQLite / libsql (Prod) | ✅ Aktuell | Breaking Migrations erlaubt — manuelles Neupflegen |
| PostgreSQL | 🔲 Roadmap | Client-Detection vorhanden; siehe `docs/postgresql.md` |

---

## Backup & Restore

| Thema | Status | Nächste Schritte |
|-------|--------|------------------|
| Welten, Seiten, Assets, Labels | ✅ | — |
| Users/Memberships/Unlocks | ✅ Restore (PR #144) | Passwort-Reset nach Restore |
| PageTemplates (custom) | ✅ Full-Backup | — |
| ShareLinks | ✅ Export ohne Token; Restore regeneriert Token | Passwörter müssen neu gesetzt werden |
| PlayerNotes | ✅ Opt-in (`includePlayerNotes`) | Datenschutz beachten |

---

## Export

| Thema | Status | Nächste Schritte |
|-------|--------|------------------|
| Static HTML Export | ✅ | `pnpm export:static` |
| Markdown/HTML Wiki-Export | 🔲 Roadmap | Zusätzlich zu Static Export; DM-only strikt filtern |
| PDF Label Export | ✅ Phase 1 | Siehe `docs/LABELS.md` |

---

## Feature-Bereiche (Phase 1 → Phase 2)

### Image Studio (`docs/IMAGE_STUDIO.md`)

| Phase 1 | Phase 2 TODO |
|---------|--------------|
| `/image-studio`, Job-Queue, RTX/Cloud-Routing | Canvas-Inpainting-UI, Seiten-Editor-Anbindung, Batch-Varianten |

### Kalender (`docs/CALENDAR_INTEGRATION.md`)

| Phase 1 | Phase 2 TODO |
|---------|--------------|
| `/calendar`, iCal-Import, FamilyWall read-only | Pro-Feed CalDAV-Passwort, Zwei-Wege-Sync, Monats-/Wochen-UI |

### DnD API (`docs/DND_API_INTEGRATION.md`)

| Phase 1 | Phase 2 TODO |
|---------|--------------|
| Package `@uwe/dnd-api`, dm_only | Encounter-Auto-Import, Bestiary-Caching |

### Agent Jobs (`docs/AGENT_JOBS.md`)

| Phase 1 | Phase 2 TODO |
|---------|--------------|
| Admin-UI, Job-Queue, GitHub Workflow | Vollständiger Cursor-Agent-Runner, Retry-Policy |

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
