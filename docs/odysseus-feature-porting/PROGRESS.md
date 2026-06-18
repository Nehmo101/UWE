# Feature-Portierung — Fortschritt

**Orchestrator:** Cloud Agent · **Letzte Aktualisierung:** 2026-06-18 (Phase 2 abgeschlossen)

## Phase 0: Planung ✅

| Task | Status | PR/Branch |
|------|--------|-----------|
| Lizenzanalyse (AGPL-3.0) | ✅ Merged | `docs/odysseus-feature-porting/LICENSE.md` |
| Feature-Portierungs-Matrix | ✅ Merged | [#106](https://github.com/Nehmo101/UWE/pull/106) |
| Subagent-Aufgaben | ✅ Merged | `docs/odysseus-feature-porting/SUBAGENTS.md` |
| PR-Strategie | ✅ Merged | `docs/odysseus-feature-porting/PR_STRATEGY.md` |

## Phase 1 Feature-PRs — alle in `main` gemerged ✅

| # | Bereich | Branch | Status | PR |
|---|---------|--------|--------|-----|
| 1 | Auth / API / Webhooks | `feature/odysseus-auth-api-patterns` | ✅ Merged | [#120](https://github.com/Nehmo101/UWE/pull/120) |
| 2 | Cookbook / Models | `feature/odysseus-cookbook-port` | ✅ Merged | [#116](https://github.com/Nehmo101/UWE/pull/116) |
| 3 | Calendar | `feature/odysseus-calendar-port` | ✅ Merged | [#115](https://github.com/Nehmo101/UWE/pull/115) |
| 4 | Document Editor | `feature/odysseus-document-editor-port` | ✅ Merged | [#121](https://github.com/Nehmo101/UWE/pull/121) |
| 5 | Image Editing | `feature/odysseus-image-editing-port` | ✅ Merged | [#118](https://github.com/Nehmo101/UWE/pull/118) |
| 6 | Email | `feature/odysseus-email-port` | ✅ Merged | [#114](https://github.com/Nehmo101/UWE/pull/114) |
| 7 | Deep Research | `feature/odysseus-deep-research-port` | ✅ Merged | [#119](https://github.com/Nehmo101/UWE/pull/119) |
| 8 | Integration | `integration/odysseus-feature-porting-final` | ✅ Docs in main | [#122](https://github.com/Nehmo101/UWE/pull/122) |

## Phase 2 — Odysseus Follow-ups ✅

| Bereich | Status | Implementierung |
|---------|--------|-----------------|
| IMAP read-only Sync-Job | ✅ | `mail_sync` Job, `MailInboxMessage`, `/api/mail/inbox` |
| CalDAV bidirektionaler Write-back | ✅ | `putCalDavEvent`, `caldavPending` Push in `calendar_sync` |
| Rich-Text Block Editor (TipTap) | ✅ | `RichTextBlockEditor` für `rich_text` / `gm_note` |
| SearXNG Web-Search | ✅ | `@uwe/web-search`, `research` Job, `SEARXNG_URL` |
| RTX Diffusion statt Image-Stub | ✅ | `diffusion.ts` — A1111 API, Ollama, Fallback-PNG |
| GameSession ↔ CalendarEvent Auto-Sync | ✅ | `syncSessionToCalendar` bei Session create/update |

## Definition of Done

- [x] Phase 1 Feature-PRs in `main` gemerged
- [x] Phase 2 Follow-ups implementiert
- [x] `pnpm quality` grün
- [x] Keine AGPL-Code-Kopie
- [x] PROGRESS aktualisiert
- [ ] Manuelle QA (`docs/TEST_PLAN.md` Ergänzungen) — optional Follow-up
