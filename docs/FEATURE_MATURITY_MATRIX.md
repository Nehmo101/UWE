# Feature Maturity Matrix

Ehrlicher Reifegrad aller UWE-Features, die als Phase 1, Scaffolding, Roadmap oder „noch nicht reif“ gelten.
Stand: Juli 2026 (Doku-Sync Wave C) · Rest-Batches 1–5 + Waves A–D + Wave C (Chronik) umgesetzt.

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
| 1 | Image Studio | Phase 2 (Projekt-Flow) | Ja (Generierung + Inpaint + Retry) | Teilweise |
| 2 | Calendar / iOS / FamilyWall | Phase 2 | Ja (lokal + Feeds + Wochenansicht) | Teilweise |
| 3 | DnD API / offene Quellen | Stable (Kern) | Ja (Suche + Statblock-Import) | Ja (Kern) |
| 4 | Agent Jobs / Orchestrator | Phase 1 done | Ja (mit Limits) | Teilweise |
| 5 | Daily Admin OS | Basis vorhanden | Ja | Teilweise |
| 6 | Import Preview / Undo | Preview ja, Undo nein | Preview ja | Preview ja |
| 7 | Secrets-/Reveal-System | Stable (Page + Block) | Ja | Ja (Kern) |
| 8 | Kanon-Konfliktprüfung | Regeln + AI + Inspector | Ja | Teilweise |
| 9 | Prepare-for-next-session | Generator + Review | Ja | Teilweise (RTX) |
| 10 | Global Search 2.0 | Erweiterte Suche v1 | Ja | Ja (Kern) |
| 11 | Performance-Budget + Testwelt | Phase 1 (CI smoke + sandbox) | Ja (perf-test sandbox) | Nein |
| 12 | Medienverwaltung | Phase 2 (Alben) | Ja | Ja (Kern) |
| 13 | Tag-/Taxonomie-Aufräumer | Service + Tests | Teilweise (API) | Nein |
| 14 | Hard UI/UX Reset — Shells + Nav | Wave 3 (C4) | Ja (Studio/Portal/Connector) | Ja (Kern) |
| 15 | Label-Druck via RTX + CUPS | Wave 1 + QF10 | Ja | Ja (CUPS-gestützt) |

---

## Reifegrad-Klassen (Stable / Beta / Lab / Deprecated)

Schnelle Einordnung. Quelle der Wahrheit für aktive Runtime/CI ist
[CURRENT_STATE.md](CURRENT_STATE.md).

### ✅ Stable / Core (production-ready Kern)

- Worlds & Wiki, Medienverwaltung (Assets), Player Portal
- Auth (Login/Setup/Reset, Rollen, TOTP) + DM-only/Leak-Schutz (Visibility)
- Linux Host Setup (systemd), Backup/Restore (Kern)
- Global Search (Kern), Static HTML / Wiki Export

### 🔶 Beta (nutzbar, nicht voll production-ready)

- Calendar (iCal/CalDAV/FamilyWall — PROPFIND/REPORT-Vollsync)
- DnD API (Open5e/SRD — Kern fertig)
- Daily Admin OS (Today/Capture/Projekte/… — teilweise)
- Secrets/Reveal (Page + Block — production-ready Kern)
- Kanon-Konfliktprüfung, Prepare-for-next-session (modell-/RTX-abhängig)
- Agent Jobs (Dispatch + Polling — kein Auto-Merge by design)

### 🧪 Lab / nicht production-ready

- **Image Studio** — Cloud-Edit/Fehler-Handling teils unvollständig (Masken-Canvas vorhanden).
- **Performance-Budget / große Testwelt** — CI-Smoke + Bundle-Budget; keine Browser-LCP-Gates.
- **Life-Brain Retrieval** — RTX-Embeddings + semantische Chunk-Suche in Studio-UI/API (`/life-brain`, Batch 4).

### ⛔ Deprecated / Removed

- **Docker** und **Windows-One-Click-Installer** — entfernt ([removed-legacy-runtime.md](removed-legacy-runtime.md)).
- **Inbound RTX-Agent** — Standalone-Tool entfernt; nur noch deprecateter
  Client-Shim. Aktiv: outbound **RTX Host Connector** + direktes Ollama/LM Studio.

---

## 1. Image Studio

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja |
| Scaffolding | `ImageEditorDraft` (optional) |
| UI | Ja — `/image-studio` (`ImageStudioJobForm` + `ImageStudioMaskCanvas`) |
| API | Ja — `GET/POST /api/image-studio` |
| DB | Ja — `ImageStudioProject`, `ImageStudioVersion`, `ImageStudioLink` |
| Tests | Minimal — 1 Config-Test, Route-Authz, Smoke |
| Nutzbar | **Ja** für `generate` / `variant` / `inpaint` (RTX + Maske) |
| Production-ready | **Teilweise** — Masken-Canvas für Inpaint; Cloud nur generate/variant |

**Was funktioniert:** Prompt → Job → RTX/Cloud → Asset; Inpaint auf Projektseite; Capture→Studio; Retry bei Fehlern; Medienbibliothek-Shortcut.

**Was nicht:** Vollständiger Canvas-Editor; Cloud-Edit-Policy in allen Pfaden dokumentiert.

**Risiken**

- DM kann Weltdaten freiwillig in Prompts für Cloud eintippen (kein Auto-Leak, aber Policy-Risiko).
- `edit`/`inpaint`/`remove_background` in API wählbar, aber ohne Quellbild nutzlos.
- Generierte Bilder umgehen Upload-Magic-Byte-Validierung (Provider-Output).

**Nächste Schritte**

1. Phase-1-UI auf `generate`/`variant` beschränken oder Quellbild-Upload.
2. `ImageStudioProject.status = failed` bei Job-Fehler.
3. Optional: `ImageEditorDraft`, erweiterte Links aus Assets/Labels.

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
- PROPFIND/REPORT-Vollsync (`syncCalDavCollection`) — externe Events werden importiert und fehlende UIDs entfernt.
- Timezone vereinfacht (UTC).

**Nächste Schritte**

1. Delete-Sync (`deleteCalDavEvent`) wo Provider es unterstützen.
2. CalDAV-Mock-Integrationstest.

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
| Production-ready | **Ja (Kern)** — Suche, Statblock-Import, Encounter-Builder |

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
| Scaffolding | `cursor_cli_local`, Orchestrator-Prompts (Doku-only) |
| UI | Ja — `/admin/agent-jobs`, `/jobs` |
| API | Ja — `/api/agent-jobs`, Job-Queue `agent_job` |
| DB | Ja — `DevAgentJob` |
| Tests | Minimal — Config-Resolution |
| Nutzbar | **Ja** — Dispatch zu GitHub Actions / Cursor Cloud |
| Production-ready | **Teilweise** — Dispatch + Polling; kein Auto-Merge (by design, siehe [SECURITY_SETTINGS.md](../SECURITY_SETTINGS.md)) |

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

**Optional (nicht im Produkt-Backlog):** Prompt-Sanitizer, robusteres Run-ID-Tracking.

**Referenzen:** `docs/AGENT_JOBS.md`, `packages/agent-jobs/`, `.github/workflows/cursor-agent.yml`

---

## 5. Daily Admin OS

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja |
| Scaffolding | Life-Brain-UI (Suche/Index) ergänzt; Capture Upload shipped |
| UI | Ja — `/today`, `/capture`, `/projects`, `/workshop`, `/contracts`, `/hardware`, `/life-brain` |
| API | Server Actions (`life-admin-actions.ts`, `capture-actions.ts`) |
| DB | Ja — Capture, Projects, Workshop, Contracts, Hardware, PersonalBrain |
| Tests | Ja — `life-admin-service.test.ts`, `today-dashboard.test.ts` |
| Nutzbar | **Ja** |
| Production-ready | **Teilweise** — README war veraltet (korrigiert) |

**Lücken:** `nextActionDate`, Global Search für Admin-Entitäten, RTX Capture-Triage. Kalender auf `/today` ist implementiert (PR #245).

**Referenzen:** `docs/daily-admin-os.md`, `apps/studio/app/today/`

---

## 6. Import Preview / Import Undo

| Kriterium | Status |
|-----------|--------|
| Import Preview | **Production-ready** |
| Import Undo | **Beta** — Activity-Log-Undo nach KnoteForge-Execute |

| Kriterium | Preview | Undo |
|-----------|---------|------|
| UI | `ImportWorkspace.tsx` | Undo über Activity Log |
| API | `/api/import/preview`, `/api/import/execute` | `undo-service` (`import.execute`) |
| DB | — | `UndoOperation` + Import-Payload |
| Tests | `importer.test.ts`, CSRF-Authz | `activity-undo.test.ts` |

**Risiko:** Undo deckt den letzten Import-Execute ab; komplexe Mehrfach-Imports erfordern weiterhin Backup.

**Nächste Schritte:** Undo für weitere Import-Quellen; klare UI-Hinweise bei irreversiblen Teilschritten.

**Referenzen:** `packages/knoteforge-import/`, `packages/database/src/undo-service.ts`

---

## 7. Secrets-/Reveal-System

| Kriterium | Status |
|-----------|--------|
| Vorhanden | Ja (Backend) |
| Scaffolding | Studio-Editor-UI für `secretLevel` / `revealState` |
| UI | **Ja (Page- + ContentBlock-Ebene)** — Studio-Editor setzt `secretLevel` / `revealState` für Seiten (#241) und Blöcke, mit `SecretReveal`-Spieler-Vorschau |
| API | Ja — AuthZ, `POST /api/admin/secrets/reveal` (Audit only) |
| DB | Ja — Migration `visibility_secret_system` (ContentBlock-Felder bereits im Schema) |
| Tests | Ja — `visibility-leak.test.ts` (inkl. Block-Secret-Leak + `maskSecretsInUi`), AuthZ |
| Nutzbar | **Ja (Page- + ContentBlock-Ebene)** — Leseschutz aktiv, Authoring im Editor |
| Production-ready | **Ja (Kern)** — Page- + ContentBlock-Editor-UI, Leak-Tests |

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

**Was existiert:** `stress-seed.ts` markiert `perf-test` als Sandbox; `listAssets`-Budget in `perf-smoke.test.ts`.

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
| DB | `Asset`, `AssetPageLink`, `AssetAlbum`, `AssetAlbumItem` |
| Tests | Ja — Upload-Security, Asset-Album, Tag-Proposals |
| Nutzbar | **Ja** |
| Production-ready | **Ja** (Kern) |

**Phase 2 (Batch 4):** `AssetAlbum`, Galerie-Blöcke v2 (`metadata.assetIds`), Batch-Tag-Vorschläge (heuristisch). Zentrales `EntityTag`-Backfill weiter offen.

**Referenzen:** `packages/assets/`, `asset-album-service.ts`, `apps/studio/app/worlds/[worldSlug]/assets/`

---

## 12b. Portal — Graph, Questlog, Session-Ankündigung

| Feature | Status | Pfade |
|---------|--------|-------|
| Beziehungsnetz | Beta | `/auth/worlds/[slug]/graph`, `PortalGraphView` |
| Questlog + Lifecycle | Beta | `/auth/worlds/[slug]/quests`, `quest-lifecycle-service`, Suche `entityFilter=quests` |
| Nächste Session | Beta | `playerVisibleSchedule`, `portal-dashboard-service` |

---

## 12c. Admin — Migration Inspector

| Kriterium | Status |
|-----------|--------|
| UI | `/admin/migrations` — angewendet / ausstehend / fehlerhaft (read-only) |
| Service | `migration-status.ts` (+ `appliedMigrations`, `failedDetails`) |
| Nutzbar | **Ja** |

---

## 12d. DnD — World-Clock & Chronik (Welle C)

| Feature | Status | Pfade |
|---------|--------|-------|
| World-Clock | Beta | `WorldCalendar`, `/worlds/[slug]/calendar`, `advanceInGameDate` |
| Welt-Chronik (Studio) | Beta | `/worlds/[slug]/chronicle`, `PageChroniclePanel` |
| Spieler-Timeline | Beta | `/auth/worlds/[slug]/timeline`, `PortalPageChronicleSection` |
| Fraktions-State | Beta | `FactionState`, `FactionStateEditPanel`, `FactionSimulatorPanel`, `simulate_faction` (Review) |

---

## 12e. Owner-Notfallmodus

| Feature | Status | Pfade |
|---------|--------|-------|
| Wartungsmodus | Beta | `SystemSettings.maintenance`, `/settings?tab=maintenance`, NL-Command |
| Middleware-Gate | Beta | `maintenance-gate.ts`, `/api/maintenance/evaluate`, Studio/Portal `middleware.ts` |
| Owner-Bypass | Beta | `evaluateMaintenanceGate` + Layout-Enforcement |

---

## 12f. World Templates

| Feature | Status | Pfade |
|---------|--------|-------|
| Welt-Archetypen | Beta | `world-templates.ts`, `world-creation-service.ts` |
| Erstellungs-UI | Beta | Studio/Portal `CreateWorldForm`, `/api/worlds` |
| Kalender-Seed | Beta | DnD + Wargame → `WorldCalendar` bei Erstellung |

---

## 13. Tag-/Taxonomie-Aufräumer

| Kriterium | Status |
|-----------|--------|
| Vorhanden | **Ja** (`tag-service.ts`) |
| Scaffolding | Studio-Admin-UI vorhanden |
| UI | **Ja** — `/admin/tags` + Asset-Tag-Feld + Life-Brain Tag-Editing (Document/Fact) |
| API | `createTagService`, `mergeTags`, `suggestTagMerges` |
| DB | JSON-Tags (kein Tag-Model) |
| Tests | `tag-service.test.ts` |
| Nutzbar | **Ja** — Admin-UI + Merge/Suggestions + Tag-Eingaben |
| Production-ready | **Ja** — Admin-UI + Tag-Felder auf Asset & Life-Brain |

**Was existiert:** Normalisierung, ähnliche Tags, Merge, unbenutzte Kandidaten, Vorschläge — `docs/engineering/tag-taxonomy.md`. Tag-Eingaben: Asset-Editor (`updateAssetAction`) und Life-Brain Document/Fact (`updateLifeBrainDocumentTagsAction`/`updateLifeBrainFactTagsAction`).

**Nächste Schritte:** optional zentrales Tag-Model.

---

## 14. Hard UI/UX Reset — Shells + Nav

| Kriterium | Status |
|-----------|--------|
| Vorhanden | **Ja** — Wave 0 + Wave 1 + Wave 2 + Wave 3 (C4 partial) |
| Nav-Vertrag | `@uwe/shared-utils/navigation` — zentraler Typ + resolveNavGroups |
| UI-Stack | Tailwind v4, shadcn-style Primitives, Lucide React, Design V2 default-on |
| Studio | `StudioShell`, `WorldShell`, `SystemShell`, `SettingsShell` — Wave 1–2 |
| Portal | `PortalShell` (AppShell) + design-v2 `PortalShellV2` bridge — Wave 1 |
| RTX Connector | `ConnectorShell` + `connector-nav.ts` — Wave 2 |
| Nutzbar | **Ja** (Studio/Portal/Connector) |

Wave-Übersicht:
| Wave 0 | Zentraler Nav-Vertrag, UI-Stack (Tailwind v4 + shadcn), `AppShell` |
| Wave 1 | `StudioShell`/`WorldShell`/`SystemShell`/`PortalShell`, QF10 Label-Druck, Portal login-first |
| Wave 2 | Welt-/Daily-Admin-/Admin-Routen auf neue Shells; `ConnectorShell` mit connector-nav IA |
| Wave 3 (C4) | Legacy-Wrapper bereinigt (`PortalPublicShell`, `StudioAppShellV2`); design-v2 bridge verifiziert |
| Wave 4 (offen) | `/settings`, `/admin` overview, Portal auth/share auf AppShell; V1 shared-ui shells entfernen |

---

## 15. Label-Druck via RTX + CUPS

| Kriterium | Status |
|-----------|--------|
| Vorhanden | **Ja** — `packages/connector/src/label-printing.ts` |
| Host-Connector | `label_printing` Capability, Queue-Claim, CUPS-Fallback |
| RTX-Client UI | `PrintersPanel` — zeigt Konfigurationshinweise |
| Env-Doku | `UWE_CONNECTOR_PRINTERS`, `UWE_CONNECTOR_PRINT_CMD` — `.env.example` |
| Docs | `docs/rtx-connector.md` — "Label printing (CUPS / local printers)" |
| Production-ready | **Ja** (CUPS-gestützt; Custom-Cmd optional) |

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
