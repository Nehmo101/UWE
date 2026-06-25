# Feature Maturity Matrix

Ehrlicher Reifegrad aller UWE-Features, die als Phase 1, Scaffolding, Roadmap oder „noch nicht reif“ gelten.
Stand: Juni 2026 · Branch-Basis `main`.

**Legende**

| Spalte | Bedeutung |
|--------|-----------|
| Vorhanden | Code/Schema existiert im Repo |
| Scaffolding | Struktur da, aber nicht nutzbar oder nur Platzhalter |
| UI | Admin-/Studio-Oberfläche |
| API | REST, Server Actions oder Job-Runner |
| DB | Prisma-Modelle + Migration |
| Tests | Unit/Integration/Security-Tests |
| Nutzbar | End-to-End für den dokumentierten Scope |
| Production-ready | Für Self-Host-Betrieb ohne bekannte Blocker |

---

## Übersicht

| # | Feature | Gesamtstatus | Nutzbar | Production-ready |
|---|---------|--------------|---------|------------------|
| 1 | Image Studio | Phase 2 (Inpaint-UI) | Ja (Generierung + Inpaint) | Nein |
| 2 | Calendar / iOS / FamilyWall | Phase 2 | Ja (lokal + Feeds + Wochenansicht) | Teilweise |
| 3 | DnD API / offene Quellen | Phase 2 | Ja (Suche + Statblock-Import) | Teilweise |
| 4 | Agent Jobs / Orchestrator | Phase 2 (Polling) | Ja (mit Limits) | Nein |
| 5 | Daily Admin OS | Basis vorhanden | Ja | Teilweise |
| 6 | Import Preview / Undo | Preview ja, Undo nein | Preview ja | Preview ja |
| 7 | Secrets-/Reveal-System | Backend ja, Editor-UI ja (Page-Ebene) | Teilweise | Nein |
| 8 | Kanon-Konfliktprüfung | Regeln + AI + Inspector | Ja | Teilweise |
| 9 | Prepare-for-next-session | Generator + Review | Ja | Teilweise (RTX) |
| 10 | Global Search 2.0 | Erweiterte Suche v1 | Ja | Ja (Kern) |
| 11 | Performance-Budget + Testwelt | Phase 1 (CI smoke) | Teilweise (Dev seed) | Nein |
| 12 | Medienverwaltung | Kern fertig | Ja | Ja (Kern) |
| 13 | Tag-/Taxonomie-Aufräumer | Service + Tests | Teilweise (API) | Nein |

---

## 1. Image Studio

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja |
| Scaffolding | Canvas/Editor-Drafts = Scaffolding |
| UI | Ja — `/image-studio` (`ImageStudioJobForm` + Projektliste) |
| API | Ja — `GET/POST /api/image-studio` |
| DB | Ja — `ImageStudioProject`, `ImageStudioVersion`, `ImageStudioLink` |
| Tests | Minimal — 1 Config-Test, Route-Authz, Smoke |
| Nutzbar | **Ja** für `generate` / `variant` / `inpaint` (RTX + Maske) |
| Production-ready | **Nein** — kein Canvas-Editor, Cloud nur generate/variant |

**Was funktioniert:** Prompt → Job → RTX oder optional Cloud DALL-E → `dm_only` Asset + Version; Inpaint-Maske + Varianten-Batch; Seiten-Link aus Editor.

**Was nicht:** Canvas, Drafts, Cloud-Edit, zuverlässiges `failed`-Handling in allen Pfaden.

**Risiken**

- DM kann Weltdaten freiwillig in Prompts für Cloud eintippen (kein Auto-Leak, aber Policy-Risiko).
- `edit`/`inpaint`/`remove_background` in API wählbar, aber ohne Quellbild nutzlos.
- Generierte Bilder umgehen Upload-Magic-Byte-Validierung (Provider-Output).

**Nächste Schritte**

1. Phase-1-UI auf `generate`/`variant` beschränken oder Quellbild-Upload.
2. `ImageStudioProject.status = failed` bei Job-Fehler.
3. Phase 2: Canvas, `ImageEditorDraft`, Links aus Assets/Labels.

**Referenzen:** `docs/IMAGE_STUDIO.md`, `packages/image-studio/`, `apps/studio/app/image-studio/`

---

## 2. Calendar / iOS Calendar / Family Wall

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja |
| Scaffolding | CalDAV Write-back (Code da, UI blockiert `read_only`) |
| UI | Ja — `/calendar`, Monats- und Wochenansicht |
| API | Ja — `/api/calendar/events`, `/api/calendar/feeds` |
| DB | Ja — `CalendarFeed`, `CalendarEvent` |
| Tests | Ja — iCal-Parse, CalDAV-Href, Service-Smoke |
| Nutzbar | **Ja** — lokaler Kalender + iCal/CalDAV/FamilyWall (read/write CalDAV optional) |
| Production-ready | **Teilweise** — SSRF-Schutz + ENV-Gates ergänzt |

**iOS Calendar:** Kein natives SDK. Indirekt über iCloud-`.ics`-URL oder CalDAV-URL + `CALDAV_PASSWORD` in `.env`.

**FamilyWall:** Typ `familywall` = iCal-URL-Fetch, read-only, kein proprietäres API.

**CalDAV:** GET-Import + optional `read_write` in UI; Feed-Passwort verschlüsselt; bidirektionaler Code (`putCalDavEvent`) bei Event-Änderungen.

**Risiken**

- SSRF bei Feed-URLs (behoben: `assertUserProvidedFetchUrlAllowed`).
- `CALENDAR_CALDAV_ENABLED` / `CALENDAR_FAMILYWALL_ENABLED` waren nicht enforced (behoben).
- Kein PROPFIND/REPORT — kein vollständiger CalDAV-Sync.
- Timezone vereinfacht (UTC).

**Nächste Schritte**

1. UI für `read_write` CalDAV + pro-Feed verschlüsselte Credentials.
2. Delete-Sync (`deleteCalDavEvent`).
3. `/today`-Aggregation mit Kalender-Events.
4. CalDAV-Mock-Integrationstest.

**Referenzen:** `docs/CALENDAR_INTEGRATION.md`, `packages/calendar/`, `apps/studio/app/calendar/`

---

## 3. DnD API / offene DnD-Datenquellen

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja |
| Scaffolding | SRD Detail-Route, Spells/Equipment in Suche, Research-UI |
| UI | Ja — `/worlds/[slug]/dnd-api` |
| API | Ja — `/api/dnd-api`; Research: `/api/research` (ohne UI) |
| DB | Ja — `DndApiCacheEntry`, `DndBeyondReference` |
| Tests | Minimal — Export-Smoke, Route-Authz |
| Nutzbar | **Ja** — Open5e-Suche + Monster-Detail, SRD-Monster, Beyond-Links |
| Production-ready | **Teilweise** — Lizenz-Hinweise ergänzt, Cache-Inkonsistenzen offen |

**Quellen**

| Provider | Status | Lizenz |
|----------|--------|--------|
| Open5e | Implementiert | CC-BY — Attribution erforderlich |
| dnd5eapi.co (SRD) | Teilweise (nur Monster in Suche) | OGL/SRD |
| D&D Beyond | Manuelle Links only | Kein Scraping (by design) |

**Risiken**

- Keine Runtime-Attribution bei API-Ergebnissen (Doku ergänzt).
- UI umgeht API-Cache; Provider-Key immer `open5e`.
- `/api/research` fehlte in Route-Policy (behoben).

**Nächste Schritte**

1. SRD-Detail-Route + Spells/Equipment in Suche.
2. UI → API-Cache nutzen.
3. Statblock-Import als UWE-Seite (Phase 2).
4. Research-UI (Odysseus-Matrix).

**Referenzen:** `docs/DND_API_INTEGRATION.md`, `packages/dnd-api/`

---

## 4. Agent Jobs / Orchestrator / Subagent-Ausführung

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja (Runtime) + Docs-only (Orchestrator) |
| Scaffolding | `cursor_cli_local`, Completion-Callback, Orchestrator-Prompts |
| UI | Ja — `/admin/agent-jobs`, `/jobs` |
| API | Ja — `/api/agent-jobs`, Job-Queue `agent_job` |
| DB | Ja — `DevAgentJob` |
| Tests | Minimal — Config-Resolution |
| Nutzbar | **Ja** — Dispatch zu GitHub Actions / Cursor Cloud |
| Production-ready | **Nein** — Status bleibt `running`, kein PR-Sync |

**Runtime vs. Doku**

- **Runtime:** Admin-Prompt → SQLite → `dispatchAgentJob` → GHA / Cursor Cloud.
- **Orchestrator/Subagents:** Nur Markdown in `docs/ai-orchestrator-subagents-prompts.md`, `docs/ai-brain-mail/` — **kein** In-App-Orchestrator.

**Sicherheitsgrenzen (bestehend + verstärkt)**

- Kein automatischer Brain/Welt-Kontext an Cloud — nur manueller Prompt.
- Tokens serverseitig; Route-Policy + optional Cloudflare Access.
- Warnung in UI/Doku: keine Secrets/Weltdaten in Prompts.

**Risiken**

- Prompt-Inhalt = Admin-Verantwortung (Leak-Vektor).
- GHA-Logs zeigen `workflow_dispatch`-Inputs.
- Placeholder `.cursor-agent-prompt.txt` auf Branch wenn CLI fehlt.
- Retry ohne Idempotenz → doppelte Runs.

**Nächste Schritte**

1. Webhook/Callback für `DevAgentJob.completed` + `prUrl`.
2. Echter `githubRunId` statt Placeholder.
3. Prompt-Sanitizer für offensichtliche Secrets (optional).

**Referenzen:** `docs/AGENT_JOBS.md`, `packages/agent-jobs/`, `.github/workflows/cursor-agent.yml`

---

## 5. Daily Admin OS

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja |
| Scaffolding | Life-Brain ohne Embeddings, Capture `file_image` ohne Upload |
| UI | Ja — `/today`, `/capture`, `/projects`, `/workshop`, `/contracts`, `/hardware`, `/life-brain` |
| API | Server Actions (`life-admin-actions.ts`, `capture-actions.ts`) |
| DB | Ja — Capture, Projects, Workshop, Contracts, Hardware, PersonalBrain |
| Tests | Ja — `life-admin-service.test.ts`, `today-dashboard.test.ts` |
| Nutzbar | **Ja** |
| Production-ready | **Teilweise** — README war veraltet (korrigiert) |

**Lücken:** Kalender auf `/today`, `nextActionDate`, Bild-Capture-Upload, Life-Brain-Retrieval.

**Referenzen:** `docs/daily-admin-os.md`, `apps/studio/app/today/`

---

## 6. Import Preview / Import Undo

| Kriterium | Status |
|-----------|--------|
| Import Preview | **Production-ready** |
| Import Undo | **Nicht vorhanden** |

| Kriterium | Preview | Undo |
|-----------|---------|------|
| UI | `ImportWorkspace.tsx` | — |
| API | `/api/import/preview`, `/api/import/execute` | — |
| DB | — | Kein `UndoOperation` für Imports |
| Tests | `importer.test.ts`, CSRF-Authz | — |

**Risiko:** Nutzer können Import für irreversibel halten. Rollback nur via Backup.

**Nächste Schritte:** Import-spezifisches Undo oder klare UI-Warnung + Backup-Hinweis.

**Referenzen:** `packages/knoteforge-import/`, `packages/database/src/undo-service.ts`

---

## 7. Secrets-/Reveal-System

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja (Backend) |
| Scaffolding | Studio-Editor-UI für `secretLevel` / `revealState` |
| UI | **Ja (Page-Ebene)** — Studio-Page-Editor setzt `secretLevel` / `revealState` (gemerged via [#241](https://github.com/Nehmo101/UWE/pull/241)) |
| API | Ja — AuthZ, `POST /api/admin/secrets/reveal` (Audit only) |
| DB | Ja — Migration `visibility_secret_system` |
| Tests | Ja — `visibility-leak.test.ts`, AuthZ |
| Nutzbar | **Ja (Page-Ebene)** — Leseschutz aktiv, Authoring im Editor; ContentBlock-/Asset-Ebene offen |
| Production-ready | **Teilweise** — Page-Editor-UI vorhanden; ContentBlock-Secrets + `maskSecretsInUi` Reveal-Button offen |

**Offen (zurückgestellt):** ContentBlock-Level-Secrets, `maskSecretsInUi` + Reveal-Button in der UI, Asset-Level-Secrets.

**Referenzen:** `docs/secrets.md`, `packages/auth/src/content-access.ts`

---

## 8. Kanon-Konfliktprüfung

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja |
| UI | Inspector + DnD-Generator-Hinweise + AI-Panel |
| API | `canon_check` Job, Brain-Action `canon_check` |
| DB | Inspector-Findings, AI Runs |
| Tests | Ja — `canon-rules.ts`, `dnd-generator.test.ts` |
| Nutzbar | **Ja** |
| Production-ready | **Teilweise** — kleine Regelmenge, RTX-abhängig |

Kein dedizierter „Kanon-Konflikt“-Screen — verteilt über Inspector, Generator und AI-Proposals (nie Auto-Kanon).

**Referenzen:** `packages/ai-brain/src/dnd-generator/canon-rules.ts`, `.cursor/skills/dnd-content-consistency-check/`

---

## 9. Prepare-for-next-session Generator

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja |
| UI | `ContextualGeneratorPanel`, Session-Seiten |
| API | `/api/dnd-generator`, `/api/ai/generator` |
| DB | `generator-service`, AI Runs |
| Tests | Ja |
| Nutzbar | **Ja** — Proposal-Workflow, kein Auto-Apply |
| Production-ready | **Teilweise** — Qualität modellabhängig |

**Referenzen:** `packages/ai-brain/src/dnd-generator/prepare-session.ts`, `docs/dnd-generator-upgrade.md`

---

## 10. Global Search 2.0

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja (kein separates „2.0“-Produkt) |
| UI | `/search`, Command Palette, Portal/Welt-Embeds |
| API | RSC + `GET /api/command/search` (kein `/api/search` REST) |
| DB | `search-service.ts`, 14 Entity-Filter |
| Tests | Ja — `search-service.test.ts`, Leak-Tests |
| Nutzbar | **Ja** |
| Production-ready | **Ja** (Kern) |

**Fehlt vs. hypothetisches 2.0:** Semantic/Embedding-Suche, dedizierte Search-API, dokumentierte v2-Roadmap.

**Referenzen:** `packages/database/src/search-service.ts`, `apps/studio/app/search/page.tsx`

---

## 11. Performance-Budget + große Testworld

| Kriterium | Status |
|-----------|--------|
| Vorhanden | **Ja** (Stress-Seed + CI-Smoke) |
| Scaffolding | Web LCP/Bundle-Budgets fehlen |
| UI / API / DB | Seed via `pnpm db:seed:stress`, Budgets in `perf-budgets.ts` |
| Tests | `perf-smoke.test.ts` in CI |
| Nutzbar | **Teilweise** — Dev-Stress-Welt (~500 Seiten), CI kleiner Smoke |
| Production-ready | **Nein** — keine Browser-Performance-Gates |

**Was existiert:** `stress-seed.ts`, `PERF_SMOKE_SCALE` / `PERF_STRESS_SCALE`, `docs/engineering/performance.md`, `migration-check.mjs` in `test:ci`.

**Nächste Schritte**

1. Größere Stress-Welt (10k+ Seiten) optional per ENV-Flag.
2. Bundle-Size / LCP Budgets in CI.
3. PostgreSQL-Lasttests.

---

## 12. Medienverwaltung

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja |
| UI | `/worlds/[slug]/assets` |
| API | Upload, signed file delivery |
| DB | `Asset`, `AssetPageLink` |
| Tests | Ja — Upload-Security, Asset-Tests |
| Nutzbar | **Ja** |
| Production-ready | **Ja** (Kern) |

**Phase 2 offen:** `AssetTag`, `AssetAlbum`, Galerie-Blöcke, Batch-AI-Tags (Odysseus-Matrix).

**Referenzen:** `packages/assets/`, `apps/studio/app/worlds/[worldSlug]/assets/`

---

## 13. Tag-/Taxonomie-Aufräumer

| Kriterium | Status |
|-----------|--------|
| Vorhanden | **Ja** (`tag-service.ts`) |
| Scaffolding | Studio-Admin-UI fehlt |
| UI | **Ja** — `/admin/tags` + Asset/Life-Brain Tag-Felder |
| API | `createTagService`, `mergeTags`, `suggestTagMerges` |
| DB | JSON-Tags (kein Tag-Model) |
| Tests | `tag-service.test.ts` |
| Nutzbar | **Ja** — Admin-UI + Merge/Suggestions |
| Production-ready | **Nein** — UI + Asset/Life-Brain Tag-Felder fehlen |

**Was existiert:** Normalisierung, ähnliche Tags, Merge, unbenutzte Kandidaten, Vorschläge — `docs/engineering/tag-taxonomy.md`.

**Nächste Schritte:** Studio-Admin-UI, Asset/Life-Brain Tag-Eingaben, optional zentrales Tag-Model.

---

## Kritische Sicherheits-Fixes (dieser PR)

| Fix | Feature |
|-----|---------|
| `assertUserProvidedFetchUrlAllowed` für iCal/CalDAV-Fetches | Calendar |
| ENV-Gates `CALENDAR_*` in API + Server Actions | Calendar |
| `enforceAiAccessPolicy` auf `POST /api/image-studio` | Image Studio |
| `ImageStudioProject.status = failed` bei Job-Fehler | Image Studio |
| Phase-1-UI nur `generate`/`variant` | Image Studio |
| `/api/research` in Route-Policy + CSRF auf POST | DnD Research |
| Ehrliche README/REPO_AUDIT-Status | Doku |
| Agent-Jobs-Sicherheitshinweis in UI + Doku | Agent Jobs |
| Open5e/SRD-Lizenz-Hinweise | DnD API |

---

## Verwandte Dokumentation

- [IMAGE_STUDIO.md](./IMAGE_STUDIO.md)
- [CALENDAR_INTEGRATION.md](./CALENDAR_INTEGRATION.md)
- [DND_API_INTEGRATION.md](./DND_API_INTEGRATION.md)
- [AGENT_JOBS.md](./AGENT_JOBS.md)
- [daily-admin-os.md](./daily-admin-os.md)
- [REPO_AUDIT.md](./REPO_AUDIT.md)
- [odysseus-feature-porting/FEATURE_PORTING_MATRIX.md](./odysseus-feature-porting/FEATURE_PORTING_MATRIX.md)
