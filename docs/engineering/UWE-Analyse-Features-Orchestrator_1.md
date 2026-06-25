# UWE Verbesserungs- & Reparaturprogramm — Orchestrator-Plan

**Stand:** 2026-06-24 · **Orchestrator:** Cloud Agent (Session 1)  
**Branch-Prefix:** `cursor/<descriptive-name>-adcf`  
**Quality Gate:** `pnpm install --frozen-lockfile && pnpm quality`

## Ist-Stand (vor diesem Programm)

| Bereich | Status | Referenz |
|---------|--------|----------|
| Theme-Token-System | ✅ merged #107–#128 | `docs/design/theme-orchestration.md` |
| View-Polish WS-1…WS-5 | ✅ merged #226–#230 | `docs/design/uwe-ansichten-analyse-und-plan.md` |
| UI-Polish Nacharbeit | ✅ merged #235 | Settings, Graph, Integrations |
| Design V2 Shell/CSS | 🔶 default-on (`NEXT_PUBLIC_UWE_DESIGN_V2`) | `packages/shared-ui/src/design-v2/` |
| UI-Element-Inventar pro Route | ✅ WP 1.1 | `docs/design/uwe-ui-element-inventory.md` |
| Browser-QA 9 Presets | ⚠️ offen | `uwe-ansichten-analyse-und-plan.md` §8 |
| Badge-Vereinheitlichung | ⚠️ offen | `.uwe-badge-*` vs `.wiki-badge-*` |
| Feature-Reife (Image Studio, Secrets-UI, …) | 🔶 siehe Matrix | `docs/FEATURE_MATURITY_MATRIX.md` |

## Nicht verhandelbare Regeln

| Regel | Enforcement |
|-------|-------------|
| Cloud-KI ohne Brain/World/Life-Kontext | `privacyGuard.ts` — **Konflikt-Datei** |
| KI = Proposal/Draft, kein Auto-Apply | AI Runs, Generator |
| Portal serverseitige Sichtbarkeit | `permissions.ts`, `pnpm test:security` |
| RTX nur LAN | `DEPLOYMENT_SECURITY.md` |
| Daily Admin nur Studio | Keine Portal-Routen für Capture/Life Brain |
| Kleine PRs, 1 Domäne/Branch | `cursor/*-adcf` |

### Konflikt-Dateien (serialisieren!)

- `packages/ai-brain/src/router/privacyGuard.ts`
- `packages/database/src/life-admin-service.ts`
- `packages/database/prisma/schema.prisma`

---

## Phasenordnung

### Phase 1 — UI-Element-Audit + Reparatur (AKTUELL)

**Subagents:** ui-auditor (führend), accessibility-engineer, frontend-engineer  
**Audit-Scope:** `docs/design/uwe-qa-urls.md` (alle Routen)  
**Bestehende Befunde:** `uwe-current-design-audit.md`, `uwe-ansichten-analyse-und-plan.md`, `theme-a11y-checklist.md`

| WP | Branch | Inhalt | Status |
|----|--------|--------|--------|
| 1.1 | `cursor/ui-element-inventory-adcf` | Vollständiges Element-Inventar + Befundliste | ✅ PR offen |
| 1.2 | `cursor/ui-fix-ghost-table-adcf` | Ghost-Klassen, fehlende States, Inline-Farben | ⏳ |
| 1.3 | `cursor/ui-fix-mobile-nav-adcf` | Bottom-Nav-Lücken (Welt-Routen, Portal Reader) | ⏳ |
| 1.4 | `cursor/ui-fix-theme-residuals-adcf` | ~155 verbleibende Hardcodes in `uwe.css` | ⏳ |
| 1.5 | `cursor/ui-fix-wiki-detail-adcf` | Badge-Dedup, WorldContextSidebar-Redundanz | ⏳ |

**Deliverable:** `docs/design/uwe-ui-element-inventory.md` + Serie kleiner Fix-PRs

---

### Phase 2 — Design-System & V1→V2-Migration

**Subagents:** design-system-engineer, frontend-engineer  
**Basis:** `design-v2-reference.md`, `shells-v2/*`, `legacy-bridge.css`

| WP | Inhalt |
|----|--------|
| 2.1 | Seiten-Migration auf `StudioShellV2`/`PortalShellV2` (Hub-Routen zuerst) |
| 2.2 | Emoji → SVG Bottom-Nav (bereits in V2, V1 abschalten) |
| 2.3 | `wiki-base.css` Extraktion (M2 aus Design-Audit) |
| 2.4 | Portal Theme-Sync (`data-theme` aus Studio-Settings) |

---

### Phase 3 — Accessibility WCAG 2.1 AA abschließen

**Subagents:** accessibility-engineer, test-engineer  
**Backlog:** `theme-a11y-checklist.md` § Offene Punkte

| WP | Inhalt |
|----|--------|
| 3.1 | Sidebar/Filter-Sheet Focus Trap |
| 3.2 | GraphView accessible names |
| 3.3 | axe-core Playwright Smoke |
| 3.4 | Kontrast-Audit automatisieren (Badge-Kombinationen) |

---

### Phase 4 — Feature-Reife (sequentiell, Konflikt-Dateien beachten)

**Subagents:** backend-architect + frontend-engineer

| Feature | Priorität | Konflikt-Risiko |
|---------|-----------|-----------------|
| Secrets-/Reveal-UI im Editor | Hoch | schema.prisma |
| Image Studio Phase 2 / failed-Status | Hoch | — |
| Kalender → `/today`-Aggregation | Mittel | life-admin-service.ts |
| Tags-Admin-UI vervollständigen | Mittel | — |
| Agent-Jobs Completion-Callback | Mittel | — |

**Reihenfolge:** Secrets-UI → Image Studio → Kalender/Today → Tags → Agent-Jobs

---

### Phase 5 — KI/RTX-System fertigstellen

**Subagents:** backend-architect, security-reviewer  
**Prompts:** `docs/ai-orchestrator-subagents-prompts.md`

| WP | Inhalt | Konflikt |
|----|--------|----------|
| 5.1 | Life Brain Retrieval (RTX-only) | privacyGuard.ts **exklusiv** |
| 5.2 | Agent-Jobs Webhook/PR-Sync | — |
| 5.3 | Prompt-Sanitizer (optional) | — |

---

### Phase 6 — Tests + Visual-Regression + Performance

**Subagent:** test-engineer

| WP | Inhalt |
|----|--------|
| 6.1 | Playwright visuelle Baselines (9 Presets × Kern-Routen) |
| 6.2 | Bundle/LCP Budgets in CI |
| 6.3 | Stress-Seed 10k+ optional |

---

### Phase 7 — DX/Doku-Sync + Observability

**Subagents:** documentation-writer, frontend-engineer

| WP | Inhalt |
|----|--------|
| 7.1 | FEATURE_MATURITY_MATRIX + REPO_AUDIT sync |
| 7.2 | Onboarding-Guide aktualisieren |
| 7.3 | System-Hub Observability-Karten |

---

### Final — QA-Vollabnahme

**Subagent:** qa-engineer  
**Checkliste:** `docs/design/uwe-qa-urls.md` (alle URLs, Mobile 390px, 9 Themes)

---

## Subagent-Dispatch-Checkliste

```txt
[x] Pflichtlektüre gelesen
[x] Konflikt-Dateien identifiziert
[x] Phasenplan dokumentiert
[x] WP 1.1 Inventar + erste Fixes
[x] pnpm quality vor Push
[x] Draft-PR pro Branch
```

## Fortschritts-Log

| Datum | Subagent | PR | Ergebnis |
|-------|----------|-----|----------|
| 2026-06-24 | Orchestrator | — | Phasenplan erstellt, WP 1.1 gestartet |
| 2026-06-24 | ui-auditor | cursor/ui-element-inventory-adcf | Inventar (53 Routen) + 5 Quick-Fixes, `pnpm quality` grün |
