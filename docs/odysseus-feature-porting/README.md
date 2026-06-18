# Odysseus → UWE Feature-Portierung

Native Übernahme von Odysseus-**Funktionsmustern** in UWE — kein paralleler Odysseus-Workspace.

## Kontext

| | UWE | Odysseus (Referenz) |
|---|-----|---------------------|
| Produkt | DnD World Wiki, Studio, Portal, Daily Admin OS | Self-hosted AI Workspace |
| Stack | TypeScript, Next.js, Prisma, SQLite | Python, FastAPI |
| Lizenz | Proprietär | **AGPL-3.0** |
| Integration | Features werden UWE-native | Nur Inspiration |

## Dokumente

| Datei | Inhalt |
|-------|--------|
| [LICENSE.md](./LICENSE.md) | AGPL-Regeln, keine Code-Kopie |
| [FEATURE_PORTING_MATRIX.md](./FEATURE_PORTING_MATRIX.md) | Vollständige Matrix aller 7 Bereiche |
| [SUBAGENTS.md](./SUBAGENTS.md) | Subagent-Aufgaben und Parallelisierung |
| [PR_STRATEGY.md](./PR_STRATEGY.md) | Branch-Schema, PR-Vorlage, Merge-Reihenfolge |
| [ORCHESTRATOR_PROMPT.md](./ORCHESTRATOR_PROMPT.md) | Prompt für Orchestrator-Runs |
| [PROGRESS.md](./PROGRESS.md) | Live-Status der Portierung |

## Feature-Bereiche

1. **Cookbook / Local Model Management** — RTX Agent, Ollama Admin, Hardware-Fit
2. **Deep Research** — Multi-Step Recherche, Reports, Brain-Integration
3. **Dokumenteneditor** — Rich-Text, Versionen, Handouts, Session Notes
4. **E-Mail** — IMAP Inbox, Drafts, Templates (Outbound existiert)
5. **Kalender** — Grid UI, CalDAV Write-back, Session-Sync
6. **Image Editing** — Canvas, Gallery, RTX `/v1/images`
7. **Auth/API** — Scoped Tokens, Webhooks, Admin Gates

## UWE-Kern bleibt unberührt

DnD-Wiki, Kanon, Sichtbarkeiten, Secrets, Handouts, Session Prep, Label-Druck, Soundboard und AI-DnD-Generator sind und bleiben UWE-Kern. Portierte Features **erweitern** Daily Admin OS und Studio — sie ersetzen es nicht.

## Schnellstart für Subagents

1. [LICENSE.md](./LICENSE.md) lesen
2. Eigenen Abschnitt in [FEATURE_PORTING_MATRIX.md](./FEATURE_PORTING_MATRIX.md) lesen
3. Branch aus [PR_STRATEGY.md](./PR_STRATEGY.md) erstellen
4. Implementieren → `pnpm quality` → PR mit Vorlage
5. Orchestrator reviewed und merged in Reihenfolge

## Verwandte UWE-Docs

- [docs/ai-brain-mail/ARCHITECTURE.md](../ai-brain-mail/ARCHITECTURE.md) — Brain/Mail/RTX-Architektur
- [docs/CALENDAR_INTEGRATION.md](../CALENDAR_INTEGRATION.md) — Kalender Phase 1
- [docs/IMAGE_STUDIO.md](../IMAGE_STUDIO.md) — Image Studio Phase 1
- [docs/daily-admin-os.md](../daily-admin-os.md) — Daily Admin OS
- [docs/life-brain-privacy.md](../life-brain-privacy.md) — Privacy-Regeln
