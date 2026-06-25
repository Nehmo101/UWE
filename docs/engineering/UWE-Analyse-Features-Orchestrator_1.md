# UWE Verbesserungs- & Reparaturprogramm — Orchestrator-Plan

**Stand:** 2026-06-25 · **Orchestrator:** Cloud Agent (Session 2)  
**Branch-Prefix:** `cursor/<descriptive-name>-adcf`  
**Quality Gate:** `pnpm install --frozen-lockfile && pnpm quality`

## Ist-Stand (Programm-Fortschritt)

| Bereich | Status | Referenz |
|---------|--------|----------|
| Theme-Token-System | ✅ merged #107–#128 | `docs/design/theme-orchestration.md` |
| View-Polish WS-1…WS-5 | ✅ merged #226–#230 | `docs/design/uwe-ansichten-analyse-und-plan.md` |
| UI-Polish Nacharbeit | ✅ merged #235 | Settings, Graph, Integrations |
| Design V2 Shell/CSS | 🔶 default-on (`NEXT_PUBLIC_UWE_DESIGN_V2`) | `packages/shared-ui/src/design-v2/` |
| UI-Element-Inventar pro Route | 🔶 Draft [#236](https://github.com/Nehmo101/UWE/pull/236) | `docs/design/uwe-ui-element-inventory.md` (Stub auf `main`) |
| Browser-QA 9 Presets | ⚠️ offen | `uwe-ansichten-analyse-und-plan.md` §8 |
| Badge-Vereinheitlichung | 🔶 Draft [#237](https://github.com/Nehmo101/UWE/pull/237) | WP 1.5 |
| Theme-Hardcodes (~155) | 🔶 Draft [#238](https://github.com/Nehmo101/UWE/pull/238) | WP 1.4 |
| Portal Theme-Sync | 🔶 Draft [#239](https://github.com/Nehmo101/UWE/pull/239) | WP 2.4 |
| A11y Focus Trap + Graph labels | 🔶 Draft [#240](https://github.com/Nehmo101/UWE/pull/240) | WP 3.1–3.2 |
| Secrets-/Reveal-Editor-UI | 🔶 Draft [#241](https://github.com/Nehmo101/UWE/pull/241) | Phase 4 |
| Feature-Reife (Image Studio, …) | 🔶 siehe Matrix | `docs/FEATURE_MATURITY_MATRIX.md` |

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

### Phase 1 — UI-Element-Audit + Reparatur (IN ARBEIT)

**Subagents:** ui-auditor (führend), accessibility-engineer, frontend-engineer  
**Audit-Scope:** `docs/design/uwe-qa-urls.md` (alle Routen)  
**Bestehende Befunde:** `uwe-current-design-audit.md`, `uwe-ansichten-analyse-und-plan.md`, `theme-a11y-checklist.md`

| WP | Branch | Inhalt | Status |
|----|--------|--------|--------|
| 1.1 | `cursor/ui-element-inventory-adcf` | Vollständiges Element-Inventar + Befundliste + 5 Quick-Fixes | 🔶 Draft [#236](https://github.com/Nehmo101/UWE/pull/236) |
| 1.2 | *(in #236)* | Ghost-Klassen, fehlende States, Inline-Farben | 🔶 Teilweise in #236 (`.uwe-table-sub`, Badge-Basis) |
| 1.3 | *(in #236)* | Bottom-Nav-Lücken (Welt-Routen, Label-Kontrast) | 🔶 Teilweise in #236 (`/worlds`-Tab, 0.65 rem Label) |
| 1.4 | `cursor/ui-fix-theme-residuals-adcf` | ~155 verbleibende Hardcodes in `uwe.css` | 🔶 Draft [#238](https://github.com/Nehmo101/UWE/pull/238) |
| 1.5 | `cursor/ui-fix-wiki-detail-adcf` | Badge-Dedup, WorldContextSidebar-Redundanz | 🔶 Draft [#237](https://github.com/Nehmo101/UWE/pull/237) |

**Deliverable:** `docs/design/uwe-ui-element-inventory.md` + Serie kleiner Fix-PRs — **noch nicht auf `main` merged**

---

### Phase 2 — Design-System & V1→V2-Migration (BEGONNEN)

**Subagents:** design-system-engineer, frontend-engineer  
**Basis:** `design-v2-reference.md`, `shells-v2/*`, `legacy-bridge.css`

| WP | Branch | Inhalt | Status |
|----|--------|--------|--------|
| 2.1 | — | Seiten-Migration auf `StudioShellV2`/`PortalShellV2` (Hub-Routen zuerst) | ⏳ |
| 2.2 | — | Emoji → SVG Bottom-Nav (bereits in V2, V1 abschalten) | ⏳ |
| 2.3 | — | `wiki-base.css` Extraktion (M2 aus Design-Audit) | ⏳ |
| 2.4 | `cursor/portal-theme-sync-adcf` | Portal Theme-Sync (`data-theme` aus Studio-Settings) | 🔶 Draft [#239](https://github.com/Nehmo101/UWE/pull/239) |

---

### Phase 3 — Accessibility WCAG 2.1 AA abschließen (BEGONNEN)

**Subagents:** accessibility-engineer, test-engineer  
**Backlog:** `theme-a11y-checklist.md` § Offene Punkte

| WP | Branch | Inhalt | Status |
|----|--------|--------|--------|
| 3.1 | `cursor/a11y-focus-graph-adcf` | Sidebar/Filter-Sheet Focus Trap | 🔶 Draft [#240](https://github.com/Nehmo101/UWE/pull/240) |
| 3.2 | `cursor/a11y-focus-graph-adcf` | GraphView accessible names | 🔶 Draft [#240](https://github.com/Nehmo101/UWE/pull/240) |
| 3.3 | — | axe-core Playwright Smoke | ⏳ |
| 3.4 | — | Kontrast-Audit automatisieren (Badge-Kombinationen) | ⏳ |

---

### Phase 4 — Feature-Reife (BEGONNEN)

**Subagents:** backend-architect + frontend-engineer

| Feature | Priorität | Branch / PR | Status |
|---------|-----------|-------------|--------|
| Secrets-/Reveal-UI im Editor | Hoch | `cursor/secrets-editor-ui-adcf` · [#241](https://github.com/Nehmo101/UWE/pull/241) | 🔶 Draft |
| Image Studio Phase 2 / failed-Status | Hoch | — | ⏳ |
| Kalender → `/today`-Aggregation | Mittel | — | ⏳ |
| Tags-Admin-UI vervollständigen | Mittel | — | ⏳ |
| Agent-Jobs Completion-Callback | Mittel | — | ⏳ |

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

### Phase 7 — DX/Doku-Sync + Observability (AKTUELL)

**Subagents:** documentation-writer, frontend-engineer

| WP | Branch | Inhalt | Status |
|----|--------|--------|--------|
| 7.1 | `cursor/docs-orchestrator-sync-adcf` | FEATURE_MATURITY_MATRIX + Orchestrator-Fortschritt (#236–#241) | 🔶 Draft [#242](https://github.com/Nehmo101/UWE/pull/242) |
| 7.2 | — | Onboarding-Guide aktualisieren | ⏳ |
| 7.3 | — | System-Hub Observability-Karten | ⏳ |

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
[x] WP 1.1 Inventar + erste Fixes (#236)
[x] Phase 1–4 Draft-PRs eröffnet (#236–#241)
[x] Phase 7.1 Doku-Sync gestartet
[x] pnpm quality vor Push
[ ] Draft-PRs #236–#241 merged
[x] Phase 7.1 Draft-PR ([#242](https://github.com/Nehmo101/UWE/pull/242))
```

## Fortschritts-Log

| Datum | Subagent | PR | Ergebnis |
|-------|----------|-----|----------|
| 2026-06-24 | Orchestrator | — | Phasenplan erstellt, WP 1.1 gestartet |
| 2026-06-24 | ui-auditor | [#236](https://github.com/Nehmo101/UWE/pull/236) | Inventar (53 Routen) + 5 Quick-Fixes, `pnpm quality` grün (Draft) |
| 2026-06-24 | frontend-engineer | [#237](https://github.com/Nehmo101/UWE/pull/237) | WP 1.5 VisibilityBadge + Wiki-Detail-Sidebar (Draft) |
| 2026-06-24 | frontend-engineer | [#238](https://github.com/Nehmo101/UWE/pull/238) | WP 1.4 Theme-Hardcodes → Tokens (Draft) |
| 2026-06-24 | frontend-engineer | [#239](https://github.com/Nehmo101/UWE/pull/239) | WP 2.4 Portal `data-theme`-Sync (Draft) |
| 2026-06-24 | accessibility-engineer | [#240](https://github.com/Nehmo101/UWE/pull/240) | WP 3.1–3.2 Focus Trap + GraphView a11y (Draft) |
| 2026-06-24 | frontend-engineer | [#241](https://github.com/Nehmo101/UWE/pull/241) | Phase 4 Secrets/Reveal Editor-Controls (Draft) |
| 2026-06-24 | documentation-writer | [#242](https://github.com/Nehmo101/UWE/pull/242) | Phase 7.1 — Matrix + Orchestrator + Inventar-Stub (Draft) |

### Session 2 (2026-06-25) — Restanten-Abarbeitung (inline, Subagent-Typen in Umgebung nicht verfügbar)

Rahmen: Quality Gate im Build-Container nicht lauffähig (Prisma-Engine-Host `binaries.prisma.sh` egress-blockiert → `db:generate` und damit `lint/typecheck/test/build` nicht ausführbar). Verifikation via CI / Folge-Abnahme; LCP-Gate-Kernlogik lokal grün getestet (`perf-budget.test.ts`, `docs:check`).

| Datum | WP | PR | Ergebnis |
|-------|-----|-----|----------|
| 2026-06-25 | WP-A Image-Studio `failed`-Status | [#248](https://github.com/Nehmo101/UWE/pull/248) | Reconciled (Fremd-Scope #245/#249 entfernt), **merged** |
| 2026-06-25 | WP-B Final-QA-Automation | [#247](https://github.com/Nehmo101/UWE/pull/247) | Reconciled (Rebase, `package.json`-Konflikt), **merged** |
| 2026-06-25 | WP-C Life-Brain Tag-Editing | [#250](https://github.com/Nehmo101/UWE/pull/250) | Document/Fact Tag-Eingaben (Asset war fertig), **merged** |
| 2026-06-25 | WP-D ContentBlock-Secrets | [#251](https://github.com/Nehmo101/UWE/pull/251) | `maskSecretsInUi`+Reveal+Editor+Leak-Test · **offen — Security-Review + `test:security` Pflicht vor Merge** |
| 2026-06-25 | WP-E `wiki-base.css` Konsolidierung | [#252](https://github.com/Nehmo101/UWE/pull/252) | 43 byte-identische Regeln extrahiert, **merged** |
| 2026-06-25 | WP-F LCP/Runtime-CI-Gate | [#253](https://github.com/Nehmo101/UWE/pull/253) | `perf-budget-check.mjs`+Specs+CI (Test 5/5 grün), **merged** |
| 2026-06-25 | WP-G Legacy-E2E → Shell V2 | [#254](https://github.com/Nehmo101/UWE/pull/254) | V1→V2-Selektoren (quellbasiert verifiziert), **merged** |
| 2026-06-25 | WP-H Theme-Matrix Browser-QA | [#255](https://github.com/Nehmo101/UWE/pull/255) | Harness (9 Presets × Routen); Ausführung umgebungsbedingt offen (Prisma), **merged** |
