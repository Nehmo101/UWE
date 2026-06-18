# Feature-Portierung — Fortschritt

**Orchestrator:** Cloud Agent · **Letzte Aktualisierung:** 2026-06-18

## Phase 0: Planung ✅

| Task | Status | PR/Branch |
|------|--------|-----------|
| Lizenzanalyse (AGPL-3.0) | ✅ Done | `docs/odysseus-feature-porting/LICENSE.md` |
| Feature-Portierungs-Matrix | ✅ Done | `docs/odysseus-feature-porting/FEATURE_PORTING_MATRIX.md` |
| Subagent-Aufgaben | ✅ Done | `docs/odysseus-feature-porting/SUBAGENTS.md` |
| PR-Strategie | ✅ Done | `docs/odysseus-feature-porting/PR_STRATEGY.md` |

## Feature-PRs

| # | Bereich | Branch | Status | PR |
|---|---------|--------|--------|-----|
| 1 | Auth / API / Webhooks | `feature/odysseus-auth-api-patterns` | 🔲 Offen | — |
| 2 | Cookbook / Models | `feature/odysseus-cookbook-port` | 🔲 Offen | — |
| 3 | Calendar | `feature/odysseus-calendar-port` | 🔲 Offen | — |
| 4 | Document Editor | `feature/odysseus-document-editor-port` | 🔲 Offen | — |
| 5 | Image Editing | `feature/odysseus-image-editing-port` | 🔲 Offen | — |
| 6 | Email | `feature/odysseus-email-port` | 🔲 Offen | — |
| 7 | Deep Research | `feature/odysseus-deep-research-port` | 🔲 Offen | — |
| 8 | Integration | `integration/odysseus-feature-porting-final` | 🔲 Offen | — |

## Bekannte Risiken

| Risiko | Mitigation |
|--------|------------|
| AGPL Code-Kopie | Strikte Review-Checkliste; nur Inspiration |
| Schema-Konflikte (7 PRs) | Merge-Reihenfolge + Rebase-Regel |
| DM-only Leaks in Research/Mail | Privacy-Tests P0; contextMode filter |
| CalDAV SSRF | URL validation wie Odysseus-Pattern, nicht Code |
| RTX `/v1/images` fehlt | Cookbook/Image PR P0 |

## Nächste Schritte

1. PR für Orchestrator-Docs mergen (`cursor/odysseus-feature-porting-orchestrator-200a`)
2. Subagent starten: **Auth/API Agent** → `feature/odysseus-auth-api-patterns`
3. Nach Auth-Merge: Cookbook + Calendar parallel

## Definition of Done (gesamt)

- [ ] Alle Feature-PRs reviewed + merged
- [ ] `pnpm quality` auf Integration-Branch
- [ ] Keine Player-Safety Regression
- [ ] Keine AGPL-Code-Kopie
- [ ] Matrix + PROGRESS final aktualisiert
