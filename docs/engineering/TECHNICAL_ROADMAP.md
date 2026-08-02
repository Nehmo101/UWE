# UWE Technical Roadmap

Stand: 2026-06-19

Technische Reihenfolge für Refactors, Skill-Fundament und wartbare Feature-Entwicklung. **Produkt-Reife** bleibt in [ROADMAP.md](../ROADMAP.md) und [FEATURE_MATURITY_MATRIX.md](../FEATURE_MATURITY_MATRIX.md).

---

## Phase 0 — Agent-Fundament (laufend)

| Item | Status | Ort |
|------|--------|-----|
| Cursor Rules | ✅ | `.cursor/rules/*.mdc` |
| Cursor Skills (15) | ✅ | `.cursor/skills/*/SKILL.md` |
| Agent quality gate | ✅ | `AGENTS.md`, `ci-quality-gate` skill |
| Engineering docs index | ✅ | `docs/engineering/cursor-workflow.md` |

Subagents: Skill-Namen aus `cursor-workflow.md` oder `.cursor/skills/README.md` wählen — nicht improvisieren.

---

## Phase 1 — Konfiguration & kleine Fixes (risikoarm)

| # | Task | Risiko | Notes |
|---|------|--------|-------|
| 1.1 | Doppelte `pnpm`-Keys in Root-`package.json` | ✅ erledigt | Ein Block `overrides.nodemailer` |
| 1.2 | Veraltete Architektur-Referenzen (Studio-Login) | ✅ erledigt | `uwe-feature-implementation/references/architecture.md` |
| 1.3 | Inline `Intl.DateTimeFormat` → `format.ts` | Niedrig | ~7 Studio-Seiten, siehe CODE_CLEANUP_REPORT |
| 1.4 | `docs:check` optional um Skills-README erweitern | — | Nicht geplant (bewusst zurückgestellt) |

---

## Phase 2 — Service-Splitting (bei nächster Feature-Berührung)

Große Dateien — **nicht blind splitten**, sondern beim nächsten Feature im gleichen Modul extrahieren.

### Priorität A — `@uwe/database` Barrel

| Datei | Zeilen | Vorschlag |
|-------|--------|-----------|
| `packages/database/src/server.ts` | ~1080 | Subpath exports: `./server/auth`, `./server/labels`, `./server/life-admin`, `./server/brain` — schrittweise, altes `./server` behalten |

**Reihenfolge:** (1) Domain-Gruppen dokumentieren als Kommentarblöcke, (2) neue Imports auf Subpaths, (3) Barrel re-export für Kompatibilität.

### Priorität B — Life Admin

| Datei | Zeilen | Vorschlag |
|-------|--------|-----------|
| `life-admin-service.ts` | ~1007 | Split: `capture-service.ts`, `personal-project-service.ts`, `hardware-service.ts`, `personal-brain-service.ts`, `today-summary.ts` |

`LifeAdminService` wird Fassade oder entfällt zugunsten einzelner `create*Service()` Factories.

**Today-Modul:** `getTodaySummary()` + `TodayAdminSummary` → `today-summary.ts` (kleinster erster Extract).

### Priorität C — Labels

| Datei | Zeilen | Vorschlag |
|-------|--------|-----------|
| `label-service.ts` | ~877 | Split: `label-content-builder.ts` (build*From*), `label-layout.ts` (normalize, applyLayout) |
| `label-export.ts` | ~752 | Bleibt separat — nur Import-Pfade anpassen |
| `LabelEditor.tsx` (Studio) | ~827 | UI-Split in Subkomponenten bei nächster Label-Feature-PR |

### Priorität D — Sonstige große Services

| Datei | Zeilen | Hinweis |
|-------|--------|---------|
| `auth.ts` | ~1285 | Nur splitten wenn Auth-Subsystem wächst |
| `repository.ts` | ~865 | Enthält Phase-1-Legacy — siehe Phase 3 |
| `ai-review-service.ts` | ~762 | Mit AI-Proposal-Workflow-Skill koordinieren |

---

## Phase 3 — Legacy-Wiki-Stack (Entscheidung nötig)

| Item | Problem | Optionen |
|------|---------|----------|
| `store.ts`, `queries.ts`, in-memory repo | Produktion nutzt Prisma; Phase-1 In-Memory-Stack nur noch Test/Legacy | A) Tests auf Prisma-Fixtures migrieren, Legacy löschen B) Als test-only dokumentieren |

**Erledigt (2026-06-26):** `@uwe/wiki-engine` wurde entfernt — es war nur durch
seinen eigenen Test referenziert, Produktions-Wikilinks leben in `@uwe/database`
(`world-inspector`, `graph-service`, …). Verbleibt: der Phase-1 In-Memory-Stack
(`store.ts` / `queries.ts` / `index.ts`), den keine App importiert.

---

## Phase 4 — Shared Utilities

| Task | Duplikate | Ziel |
|------|-----------|------|
| `slugifyDe()` / `pickUniqueSlug()` | 6+ Stellen | `@uwe/database` oder kleines `@uwe/text-utils` |
| Datumsformatierung | Studio-Seiten | `apps/studio/src/lib/format.ts` Presets erweitern |

---

## Phase 5 — Infrastruktur (optional, homelab)

Siehe [ROADMAP.md](../ROADMAP.md) und Skill `hardware-homelab`:

- Distributed session store (horizontal scale)
- Self-hosted GitHub runner (`docs/engineering/self-hosted-ci.md`)
- PostgreSQL production path (`docs/postgresql.md`)

---

## Skill → Domäne (Quick Reference)

| Domäne | Skill |
|--------|-------|
| Architektur | `uwe-architecture` |
| Feature implementieren | `uwe-feature-implementation` |
| API Routes | `api-routes` |
| React/Next UI | `react-next-ui` |
| Auth/Zugänge | `auth-access` |
| AI / Proposals | `ai-agent-proposal-workflow` |
| Local-first / Datenschutz | `local-first-privacy` |
| DnD + Life Brain | `uwe-brain` |
| DnD Content QA | `dnd-content-consistency-check` |
| Portal Spieler | `portal-player-view` |
| DB Migrations | `database-migration-review` |
| CI / Quality | `ci-quality-gate` |
| Security Audit | `security-audit` |
| PR Review | `pr-review` |
| Cloudflare Deploy | `deployment-cloudflare-check` |
| Homelab / Host | `hardware-homelab` |

---

## Verwandte Dokumente

- `CODE_CLEANUP_REPORT.md` (Datei entfernt)
- `REPO_AUDIT.md` (Datei entfernt)
- [cursor-workflow.md](./cursor-workflow.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
