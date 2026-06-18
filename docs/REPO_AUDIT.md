# UWE Repository Audit

Stand: 2026-06-18 (Version 0.1.0, Branch `main`).  
Zweck: Orientierung für Featurebereiche und Reifegrad — siehe auch [ROADMAP.md](./ROADMAP.md).

## Annahmen (aus Repo abgeleitet)

| Thema | Annahme |
|-------|---------|
| Framework | Next.js 15 App Router, React 19, TypeScript, pnpm Monorepo + Turborepo |
| Datenbank | Prisma 7, SQLite (libsql), Schema in `packages/database/prisma/schema.prisma` |
| Auth Studio | Session-Login (owner/admin/dm, `AUTH_REQUIRED=true`); Netzwerk-/Proxy-Schutz + optional `STUDIO_API_TOKEN` |
| Auth Portal | Session-Cookies, Rollen (`owner`/`admin`/`dm`/`player`), Preview-as-Player, Forgot/Reset |
| Image Studio | Phase 1 — `/image-studio`, Job-Queue; siehe `docs/IMAGE_STUDIO.md` |
| Kalender | Phase 1 — `/calendar`, iCal/CalDAV read-only; siehe `docs/CALENDAR_INTEGRATION.md` |
| Cursor-Agent-Jobs | Phase 1 — Admin-UI + Job-Queue; siehe `docs/AGENT_JOBS.md` |
| Daily Admin OS | DB-Modelle und Basis-UI vorhanden; vollständige Cockpit-Integration teils noch ausbaubar |

Build-Verifikation während Audit: `pnpm install`, `db:generate`, `pnpm typecheck` — erfolgreich.

---

## 1. Projektstruktur

```
uwe/                          # Root — pnpm workspace, Turbo, ESLint flat config
├── apps/
│   ├── studio/               # UWE Studio (DM) — Port 3000
│   └── portal/               # UWE Portal (Spieler) — Port 3001
├── packages/
│   ├── database/             # Prisma, Repository, Domain-Services
│   ├── ai-brain/             # KI-Router, DnD-Generator, Brain-Retrieval, RTX
│   ├── assets/               # Upload-Pfade, Storage-Keys, MIME
│   ├── auth/                 # Rollen, Sessions, Runtime-Config
│   ├── backup/               # Backup/Restore
│   ├── config/               # Shared tsconfig
│   ├── knoteforge-import/    # JSON-Import
│   ├── mail/                 # SMTP, Compose
│   ├── shared-ui/            # AppShell, MobileBottomNav, Badges
│   ├── soundboard/           # Spotify OAuth, Playback
│   ├── static-export/        # HTML-Export
│   └── wiki-engine/          # Wikilink-Parsing
├── tools/
│   ├── uwe-rtx-agent/        # Lokaler RTX-Inferenz-Worker
│   └── windows-installer/    # Windows One-Click-Setup
├── docs/                     # Produkt- und Implementierungsdoku
├── scripts/                  # Release, Selfhost, Integration-Smoke-Tests
├── .github/workflows/        # CI, Windows-Installer
├── docker-compose.yml        # Studio + Portal + SQLite-Volume
└── data/                     # uploads, backups (dev)
```

**Apps im Detail**

| App | Routing | Server-Logik |
|-----|---------|--------------|
| Studio | `apps/studio/app/**` | Server Actions (`app/*-actions.ts`), API `app/api/**` |
| Portal | `apps/portal/app/**` | API `app/api/**`, Middleware `middleware.ts` |

**Shared Packages Pattern:** Domain-Logik in `packages/database` und Fach-Packages; Apps sind dünne Next.js-Schicht.

---

## 2. Relevante Dateien / Module

### Medienverwaltung & Bild-Upload

| Bereich | Pfad | Rolle |
|---------|------|-------|
| Asset-Repository | `packages/database/src/asset-repository.ts` | CRUD, Verknüpfung mit Seiten |
| Upload-Storage | `packages/assets/src/storage.ts` | `buildStorageKey`, Pfad-Sicherheit |
| Upload-Pfade | `packages/assets/src/data-paths.ts` | `UPLOADS_DIR`, `UWE_DATA_DIR` |
| Studio Assets-UI | `apps/studio/app/worlds/[worldSlug]/assets/page.tsx` | Bibliothek, Filter, Share-Links |
| Upload API | `apps/studio/app/api/worlds/[worldSlug]/assets/upload/route.ts` | Multipart → Datei + DB |
| Asset-File API | `apps/studio/app/api/assets/[assetId]/file/route.ts` | Inline-Delivery |
| Portal Asset-File | `apps/portal/app/api/assets/[assetId]/file/route.ts` | Visibility-gefiltert |
| Share Asset-File | `apps/portal/app/api/share/[token]/assets/[assetId]/file/route.ts` | Token-geschützt |
| Asset Actions | `apps/studio/app/asset-actions.ts` | Link, Update, Delete |
| Permissions | `packages/database/src/permissions.ts` | `filterAssetsForContext` |
| Label-Bilder | `packages/database/src/label-image-provider.ts` | Bild-URLs für Export |

### Wissenstexte (DnD-Brain / Wiki)

| Bereich | Pfad | Rolle |
|---------|------|-------|
| Brain Store Service | `packages/database/src/brain-store-service.ts` | Documents, Facts, Chunks, Links |
| Brain UI (Welt) | `apps/studio/app/worlds/[worldSlug]/brain/**` | CRUD Wissenstexte |
| Brain UI (global) | `apps/studio/app/brain/page.tsx` | Übersicht |
| Brain API | `apps/studio/app/api/worlds/[worldSlug]/brain/route.ts` | REST |
| Brain Knowledge Source | `packages/ai-brain/src/context/db-brain-knowledge-source.ts` | Retrieval für KI |
| Embeddings | `packages/ai-brain/src/embeddings/**` | Chunking, Index, Search |
| Aktion „Wissenstext erweitern“ | `packages/ai-brain/src/actions.ts` (`expand_knowledge`) | Brain-Action |
| Wiki-Seiten (Lore) | `packages/database/src/page-service.ts` | Content-Blocks, Rendering |

### DnD Generator

| Bereich | Pfad | Rolle |
|---------|------|-------|
| Generator Service | `packages/database/src/generator-service.ts` | Presets, Outputs, Actions |
| DnD Generator Core | `packages/ai-brain/src/dnd-generator/**` | Actions, Context, Player-Safe |
| Generator API (View) | `apps/studio/app/api/dnd-generator/route.ts` | GET Kontext + Historie |
| Generator API (Run) | `apps/studio/app/api/ai/generator/route.ts` | POST Aktion starten |
| Generator Handlers | `apps/studio/src/lib/generator-handlers.ts` | Job/Run-Orchestrierung |
| UI Panel | `apps/studio/components/ContextualGeneratorPanel.tsx` | Seitenbearbeitung |
| AI Brain Sidebar | `apps/studio/components/AiBrainSidebar.tsx` | Brain-Aktionen |
| Doku | `docs/dnd-generator-upgrade.md` | Aktionen, Review, Safety |

### Brain / Kanon-Kontext

| Bereich | Pfad | Rolle |
|---------|------|-------|
| AI Router | `packages/ai-brain/src/router/aiRouter.ts` | Modus Auto/RTX/Cloud |
| Privacy Guard | `packages/ai-brain/src/router/privacyGuard.ts` | Cloud-Block bei Brain |
| Context Builder | `packages/ai-brain/src/context/context-builder.ts` | Budget, Visibility |
| Brain Run API | `apps/studio/app/api/brain/run/route.ts` | Brain-Aktionen ausführen |
| Brain Actions API | `apps/studio/app/api/brain/actions/route.ts` | Verfügbare Aktionen |
| AI Context API | `apps/studio/app/api/ai/context/route.ts` | Kontextmodi |
| Proposals/Review | `packages/database/src/ai-review-service.ts` | Apply/Discard |
| World Inspector | `packages/database/src/world-inspector.ts` | Kanon-Warnungen |

### Player Preview / Visibility

| Bereich | Pfad | Rolle |
|---------|------|-------|
| Visibility Security Tests | `packages/database/src/visibility-security.test.ts` | Hard Security |
| Permissions | `packages/database/src/permissions.ts` | Portal/Preview/DM Filter |
| Studio Preview | `apps/studio/app/worlds/.../page.tsx` | `?preview=player` |
| Preview URL Builder | `apps/studio/app/actions.ts` | `pagePreviewHref` |
| Portal Preview API | `apps/portal/app/api/auth/preview/route.ts` | Preview-as-Player Cookie |
| Portal Preview UI | `apps/portal/src/components/PreviewAsPlayerForm.tsx` | Spieler-Auswahl |
| Runtime Config | `packages/auth/src/runtime-config.ts` | `PLAYER_PREVIEW_*` Env |
| Static Export Safety | `packages/static-export/**` | Kein DM-Leak im Export |
| Inspector Fixes | `packages/database/src/inspector-fix-service.ts` | Visibility-Fixes |

### Dungeon Cockpit

| Bereich | Pfad | Rolle |
|---------|------|-------|
| Dungeon Service | `packages/database/src/dungeon-cockpit.ts` | Hierarchie, Room Cockpit |
| Dungeon UI | `apps/studio/app/worlds/[worldSlug]/dungeons/**` | Ebenen, Räume |
| Room Cockpit Page | `.../raeume/[roomSlug]/page.tsx` | Read-Aloud, Encounters, Labels |
| Dungeon Actions | `apps/studio/app/dungeon-actions.ts` | Create, Prep-Status, Labels |
| Migration | `prisma/migrations/20260611230000_dungeon_cockpit/` | `prep_status` auf Pages |
| Tests | `packages/database/src/dungeon-cockpit.test.ts` | |

### 6×4 Labeldruck

| Bereich | Pfad | Rolle |
|---------|------|-------|
| Label Service | `packages/database/src/label-service.ts` | Labels, Templates |
| Label Editor | `apps/studio/components/LabelEditor.tsx` | 6×4 visueller Editor |
| Label Edit Workspace | `apps/studio/components/LabelEditWorkspace.tsx` | Speichern, Export |
| Print Lists | `packages/database/src/label-print-list-service.ts` | Listen, Kopien |
| Print List UI | `apps/studio/components/PrintListEditor.tsx` | |
| Export | `packages/database/src/label-export.ts` | PDF/HTML/PNG |
| Export API | `apps/studio/app/api/worlds/.../labels/[labelId]/export/route.ts` | |
| Print List Export | `apps/studio/app/api/worlds/.../print-lists/[printListId]/export/route.ts` | |
| Safety | `packages/database/src/label-safety.ts` | DM vs Player Export |
| Doku | `docs/LABELS.md` | |

### Admin-Portal Mobile UI

| Bereich | Pfad | Rolle |
|---------|------|-------|
| Mobile Bottom Nav | `packages/shared-ui/src/MobileComponents.tsx` | `MobileBottomNav` |
| Studio Mobile Nav | `apps/studio/src/lib/mobile-nav.ts` | Heute/Capture/Suche/KI/Mehr |
| Portal Mobile Nav | `apps/portal/src/lib/mobile-nav.ts` | Welt/Auth Nav |
| AppShell | `packages/shared-ui/src/AppShell.tsx` | Bottom Nav Slot |
| Mobile KI-Prompt | `apps/studio/app/admin/ai-prompt/page.tsx` | |
| Mobile KI Panel | `apps/studio/components/MobileAiPromptPanel.tsx` | |
| Global Capture FAB | `apps/studio/components/GlobalCaptureFab.tsx` | Alle Studio-Views |
| PWA Manifest | `apps/studio/public/manifest.webmanifest` | |
| CSS | `apps/studio/app/wiki.css`, `packages/shared-ui/uwe.css` | Mobile Styles |

### Auth / Settings / Secrets

| Bereich | Pfad | Rolle |
|---------|------|-------|
| Auth Service | `packages/database/src/auth.ts` | Login, Sessions |
| Auth Package | `packages/auth/**` | Password, Session-Token, Proxy |
| Portal Login | `apps/portal/app/login/page.tsx` | |
| Portal Middleware | `apps/portal/middleware.ts` | Auth-Routen |
| Settings Service | `packages/database/src/settings-service.ts` | `SystemSettings` JSON |
| Settings UI | `apps/studio/app/settings/page.tsx` | Tabs General/Worlds/AI/Mail/… |
| Settings API | `apps/studio/app/api/settings/route.ts` | |
| Settings Validation | `packages/database/src/settings-validation.ts` | |
| Token Crypto | `packages/database/src/token-crypto.ts` | Spotify, Share passwords |
| Studio API Auth | `apps/studio/src/lib/studio-api-auth.ts` | CSRF + Bearer Token |
| Env | `.env.example` | Alle Secrets dokumentiert |
| Production Safety | `packages/database/src/production-safety.ts` | Seed/Migration Checks |
| Admin Status | `packages/database/src/admin-status.ts` | System-Ampel |

### Daily Admin OS (Life Admin)

| Bereich | Pfad | Rolle |
|---------|------|-------|
| Life Admin Service | `packages/database/src/life-admin-service.ts` | Capture, Projects, … |
| Today Dashboard | `apps/studio/app/today/page.tsx` | Cockpit |
| Today Logic | `apps/studio/src/lib/today-dashboard.ts` | Favorit-Welt, Karten |
| Capture | `apps/studio/app/capture/page.tsx` | Inbox |
| Projects / Workshop / Contracts / Hardware | `apps/studio/app/{projects,workshop,contracts,hardware}/` | |
| Life Brain | `apps/studio/app/life-brain/page.tsx` | Persönliches Brain |
| Admin Sidebar | `apps/studio/src/lib/admin-sidebar-nav.ts` | Navigation |
| Doku | `docs/daily-admin-os.md`, `docs/life-brain-privacy.md` | |

### Jobs / Hintergrundarbeit

| Bereich | Pfad | Rolle |
|---------|------|-------|
| Job Service | `packages/database/src/job-service.ts` | Enqueue, Retry, Status |
| Job Runners | `apps/studio/src/lib/job-runners.ts` | mail, ai_run, embedding, … |
| Job API | `apps/studio/app/api/jobs/route.ts`, `[jobId]/route.ts` | |
| Jobs UI | `apps/studio/app/jobs/page.tsx`, `JobsWorkspace.tsx` | |
| RTX Deferred | `packages/database/src/rtx-deferred-jobs.ts` | Warteschlange bei RTX offline |

### RTX Agent (extern)

| Pfad | Rolle |
|------|-------|
| `tools/uwe-rtx-agent/**` | Lokaler Inferenz-Dienst |
| `packages/ai-brain/src/rtx-agent-client.ts` | UWE → Agent |
| `packages/ai-brain/src/providers/rtx-agent-provider.ts` | Provider-Integration |

---

## 3. Relevante Datenmodelle

Prisma-Schema: `packages/database/prisma/schema.prisma` (SQLite).

### Kern-Welt & Wiki

| Model | Zweck |
|-------|-------|
| `World`, `Campaign` | Welten, Kampagnen |
| `Page` | Wiki-Entitäten (`PageType`: npc, location, dungeon, room, …) |
| `ContentBlock` | Rich Text, Bilder, GM-Notes (`ContentBlockType`) |
| `PageLink` | Wiki-Relationen |
| `Asset` | Medien (`AssetType`: image, map, handout, audio, …) |
| `AssetPageLink` | Asset ↔ Seite |

### Sichtbarkeit & Spieler

| Model | Zweck |
|-------|-------|
| `Visibility`, `PublishStatus`, `CanonicalStatus` | Enums auf Page/Block/Asset |
| `User`, `WorldMembership` | Rollen pro Welt |
| `PagePlayerAccess`, `SessionUnlock` | `specific_players`, `unlock_after_session` |
| `PlayerNote` | Spieler-Notizen mit Status/Visibility |
| `ShareLink`, `ShareAccessLog` | Token-Links für Handouts/Assets |

### Sessions & Dungeon

| Model | Zweck |
|-------|-------|
| `GameSession` | Termin (`date`), Recaps, Status |
| `GameSessionPageLink` | Session ↔ Seiten |
| `Page.prepStatus` | `DungeonPrepStatus` für Räume |

### Brain / KI

| Model | Zweck |
|-------|-------|
| `BrainDocument`, `BrainChunk` | Wissenstexte + Embeddings (JSON) |
| `BrainFact` | Strukturierte Facts |
| `BrainLink` | Verknüpfungen Brain ↔ Page/Session/… |
| `AiRun` | KI-Ausführungs-Historie |
| `AiProposal`, `AiApplyLog` | Review/Apply-Workflow |
| `GeneratorPreset`, `GeneratorOutput` | DnD-Generator Presets/Outputs |
| `Job`, `JobLog` | Hintergrund-Jobs |

### Labels

| Model | Zweck |
|-------|-------|
| `LabelTemplate` | 6×4 Layout-Vorlagen |
| `Label` | Label-Inhalt (JSON), `LabelSourceType` |
| `PrintList`, `PrintListItem` | Drucklisten mit Kopien |

### Soundboard & Mail

| Model | Zweck |
|-------|-------|
| `SoundboardButton` | Local/YouTube/Spotify |
| `SpotifyConnection` | OAuth pro Welt (encrypted) |
| `MailTemplate`, `MailRecipientGroup`, `MailRecipient` | Mail Center |
| `MailMessageLog` | Versand-Log |

### Daily Admin OS

| Model | Zweck |
|-------|-------|
| `CaptureEntry` | Inbox (`CaptureType` inkl. `file_image`) |
| `PersonalProject` | Projekte mit optionaler Welt-Verknüpfung |
| `WorkshopProject` | Werkstatt (`imageGallery`, `referenceImages`) |
| `ContractExpense` | Verträge (`nextPaymentDate`, `renewalDate`) |
| `HardwareDevice` | Homelab-Geräte |
| `PersonalBrainDocument`, `PersonalBrainFact` | Life-Brain |
| `AdminEntityLink` | Querverweise Admin-Entitäten |

### System

| Model | Zweck |
|-------|-------|
| `SystemSettings` | JSON-Blob (Pfade, AI, Mail, App) |
| `ActivityLog`, `UndoEntry` | Audit + Undo |
| `PageTemplate`, `SeedHistory` | Quick-Create Templates |
| `Session` (auth) | Portal-Session-Tokens |

---

## 4. Relevante API-Routen

### Studio (`localhost:3000`)

| Route | Methode | Zweck |
|-------|---------|-------|
| `/api/health` | GET | DB + Storage Health |
| `/api/settings` | GET/POST | SystemSettings |
| `/api/assets/[assetId]/file` | GET | Asset-Datei (Studio) |
| `/api/worlds/[worldSlug]/assets/upload` | POST | Bild/Datei-Upload |
| `/api/worlds/[worldSlug]/brain` | GET/POST | Brain-Einträge |
| `/api/worlds/[worldSlug]/brain/[entryId]` | GET/PATCH/DELETE | Einzel-Eintrag |
| `/api/worlds/[worldSlug]/graph` | GET | Graph-Daten |
| `/api/worlds/[worldSlug]/labels/[labelId]/export` | GET | Label PDF/HTML/PNG |
| `/api/worlds/[worldSlug]/print-lists/[printListId]/export` | GET | Druckliste Export |
| `/api/dnd-generator` | GET | Generator-View/Kontext |
| `/api/ai/generator` | POST | Generator-Aktion starten |
| `/api/ai/generate` | POST | Generische KI-Generierung |
| `/api/ai/context` | GET/POST | Kontextmodi |
| `/api/ai/runs`, `/api/ai/runs/[runId]` | GET | Run-Historie |
| `/api/ai/proposals/[id]`, `/discard` | POST | Review |
| `/api/ai/save`, `/api/ai/sessions`, `/api/ai/settings`, `/api/ai/prompt`, `/api/ai/models` | diverse | KI-Subsystem |
| `/api/brain/run`, `/api/brain/actions`, `/api/brain/runs/**` | diverse | Brain-Aktionen |
| `/api/jobs`, `/api/jobs/[jobId]` | GET/POST/PATCH | Job-Queue |
| `/api/mail/**` | diverse | Mail Center |
| `/api/backup/**` | diverse | Backup/Restore |
| `/api/import/preview`, `/execute`, `/formats` | POST | Import |
| `/api/export/static` | POST | Static HTML Export |
| `/api/inference/health`, `/test-prompt` | GET/POST | RTX-Status |
| `/api/admin/status` | GET | Admin-Dashboard JSON |
| `/api/command/search` | GET | Command Palette |
| `/api/spotify/callback` | GET | Spotify OAuth |
| `/api/worlds/[worldSlug]/spotify/*` | diverse | Playback Control |

**Auth-geschützt** (via `requireStudioApiAuth`): backup, restore, import, settings, AI, export, uploads, jobs — siehe `studio-api-auth.ts`.

### Portal (`localhost:3001`)

| Route | Methode | Zweck |
|-------|---------|-------|
| `/api/health` | GET | Health |
| `/api/auth/login`, `/logout` | POST | Spieler-Login |
| `/api/auth/preview` | POST | Preview-as-Player |
| `/api/assets/[assetId]/file` | GET | Visibility-gefiltert |
| `/api/share/[token]/verify`, `.../assets/.../file` | POST/GET | Share-Links |
| `/api/worlds/[worldSlug]/graph` | GET | Portal-Graph |

**Keine Studio-APIs im Portal** — Daten über `@uwe/database/server` Repository direkt in RSC.

---

## 5. Wo Image Studio integriert werden soll

Image Studio ist **nicht implementiert**. Empfohlene Anknüpfpunkte:

| Priorität | Ort | Begründung |
|-----------|-----|------------|
| 1 | `apps/studio/app/worlds/[worldSlug]/assets/page.tsx` | Zentrale Medienbibliothek — „Bearbeiten in Image Studio“ |
| 2 | `apps/studio/app/api/worlds/[worldSlug]/assets/upload/route.ts` | Post-Upload Hook / neue Route `assets/[id]/edit` |
| 3 | `apps/studio/components/LabelEditor.tsx` | Bereits Bild-Elemente, Crop/Zoom — erweitern oder in Studio verlinken |
| 4 | `packages/assets/src/storage.ts` | Neue Storage-Keys für bearbeitete Varianten (Original bleibt) |
| 5 | `packages/database` `Asset.metadata` | JSON für Edit-History, Crop-Rects, Variant-Keys |
| 6 | `apps/studio/app/capture/page.tsx` + `CaptureType.file_image` | Capture → Asset → Image Studio Pipeline |
| 7 | `apps/studio/app/workshop/page.tsx` | `WorkshopProject.referenceImages`, `progressPhotos` |
| 8 | `apps/studio/app/worlds/.../edit/page.tsx` | Content-Block `image` — direkte Bildbearbeitung |
| 9 | `packages/static-export` | Export nur finaler/sicherer Asset-Varianten |

**Neues Package empfohlen:** `packages/image-studio` oder UI in `apps/studio/components/ImageStudio/` — Bearbeitung clientseitig (Canvas), Speichern über bestehende Upload-API.

---

## 6. Wo Kalender integriert werden soll

**Kein Kalender-Feature vorhanden.** Termin-Daten existieren bereits:

| Datenquelle | Felder | UI heute |
|-------------|--------|----------|
| `GameSession` | `date`, `status`, `sessionNumber` | `/worlds/.../sessions`, Dashboard „Nächste Session“ |
| `ContractExpense` | `nextPaymentDate`, `renewalDate`, `cancelByDate`, `billingDay` | `/contracts` (Tabellenform) |
| `CaptureEntry` | `capturedAt`, `triagedAt` | `/capture` |
| `PersonalProject` / `WorkshopProject` | `nextAction` (Text, kein Datum) | Listen |

**Empfohlene Integration:**

| Priorität | Ort | Zweck |
|-----------|-----|-------|
| 1 | Neue Route `/calendar` oder `/today` Erweiterung | Monats-/Wochenansicht |
| 2 | `apps/studio/app/today/page.tsx` | „Heute“ + „Diese Woche“ Aggregat |
| 3 | `packages/database/src/life-admin-service.ts` | `listUpcomingEvents()` über Sessions + Contracts |
| 4 | Neue API `/api/calendar/events` oder Server Action | Unified Event Feed |
| 5 | `apps/studio/src/lib/admin-sidebar-nav.ts` | Nav-Eintrag Kalender |
| 6 | Optional: `CalendarEvent` Model | Wenn freie Termine/Reminder nötig (Migration) |

**Annahme:** Kalender ist read-mostly Aggregation — keine Bank-/externe Sync in v1.

---

## 7. Wo DnD APIs integriert werden sollen

Bestehende DnD-KI-Schicht — Erweiterungen hier anbinden:

| Schicht | Pfad | Integration |
|---------|------|-------------|
| Task-Definitionen | `packages/ai-brain/src/tasks.ts` | Neue `AiTaskType` |
| Brain-Aktionen | `packages/ai-brain/src/actions.ts` | Neue `BrainActionId` |
| DnD Generator Actions | `packages/ai-brain/src/dnd-generator/actions.ts` | UI-sichtbare Aktionen |
| Generator Service | `packages/database/src/generator-service.ts` | Presets, Outputs |
| API GET (Kontext) | `apps/studio/app/api/dnd-generator/route.ts` | Neue Kontext-Typen (`kind=`) |
| API POST (Run) | `apps/studio/app/api/ai/generator/route.ts` → `generator-handlers.ts` | Ausführung |
| Job Runner | `apps/studio/src/lib/job-runners.ts` | `ai_run`, `canon_check` Jobs |
| UI | `ContextualGeneratorPanel.tsx`, `AiBrainSidebar.tsx`, Edit-Page | Buttons pro Seitentyp |
| Review | `ai-review-service.ts`, `/worlds/.../ai-runs` | Apply/Discard |
| Externe DnD-Daten (SRD, Monsters) | **Neu:** `packages/dnd-api/` oder `packages/ai-brain/src/dnd-external/` | Nur DM-only, nie Portal |

**Regel aus Repo:** Kein Auto-Apply; Cloud nur für Allgemeinen Chat — `privacyGuard.ts` erweitern bei neuen Kontexten.

---

## 8. Wo Cursor-Agent-Jobs integriert werden sollen

Zwei Ebenen:

### A) Runtime Job-Queue (Produkt)

| Ort | Zweck |
|-----|-------|
| `packages/database` `Job` / `JobType` enum | Neue Typen z. B. `cursor_agent` (Migration nötig) |
| `packages/database/src/job-service.ts` | Enqueue, Retry-Policy |
| `apps/studio/src/lib/job-runners.ts` | Runner implementieren |
| `apps/studio/src/lib/job-api-handlers.ts` | API-Enqueue |
| `apps/studio/app/jobs/page.tsx` | UI-Status |
| `packages/database/src/admin-status.ts` | Ampel „Jobs hängen“ |

RTX-abhängige Jobs: `packages/database/src/rtx-deferred-jobs.ts` — gleiches Pattern für Agent-Jobs mit lokalem Kontext.

### B) Cursor-Orchestrierung (Entwicklung)

| Dokument | Zweck |
|----------|-------|
| `docs/ai-brain-mail/ORCHESTRATOR_PROMPT.md` | Master-Prompt für Cursor Agent |
| `docs/ai-brain-mail/GRANULAR_TASKS.md` | P00–P13 Pakete |
| `docs/ai-brain-mail/SUBAGENTS.md` | Subagent-Rollen |
| `docs/ai-brain-mail/PROGRESS.md` | Fortschritt P01–P12 |
| `docs/ai-orchestrator-subagents-prompts.md` | Zusatz-Prompts |

**Empfehlung:** Runtime-Jobs für lange KI/Import/Backup-Tasks; Cursor-Agent-Arbeit bleibt in `docs/` + Git — optional Job-Typ wenn Agent-Runs in DB auditierbar sein sollen.

---

## 9. Welche Migrationen nötig sind

### Bereits angewendet (21 Migrationen)

Von `20260611214509_init_uwe_data_model` bis `20260614074010_daily_admin_os_extensions`.

### Wahrscheinlich für geplante Features

| Feature | Migration |
|---------|-----------|
| Image Studio | Optional: `AssetVariant` Tabelle oder erweitertes `Asset.metadata`; kein Schema zwingend |
| Kalender | Optional: `CalendarEvent` + `reminderAt`; oder nur Aggregation ohne Migration |
| DnD externe APIs | Optional: `ExternalReference` / Cache-Tabelle |
| Cursor Agent Jobs | `JobType` enum erweitern in Prisma + Migration |
| Daily Admin OS Rest | Prüfen ob `nextActionDate` auf Projects/Workshop fehlt |
| PostgreSQL-Option | Roadmap-Item — Provider-Wechsel, keine SQLite-spezifische Logik in Services prüfen |

**Workflow:** `pnpm --filter @uwe/database db:migrate` — CI führt `db:generate` aus, nicht migrate (lokale DB in Tests oft frisch).

---

## 10. Welche Risiken bestehen

| Risiko | Schwere | Details |
|--------|---------|---------|
| Studio ohne AUTH_REQUIRED öffentlich | **Kritisch** | DM-Daten ohne Session-Schutz; `studio-security.test.ts`, `SECURITY.md` |
| DM-only Leak ins Portal | **Kritisch** | `visibility-security.test.ts` — bei Änderungen erneut prüfen |
| Cloud-KI + Brain-Kontext | **Kritisch** | `privacyGuard.ts` — Regression in `privacy.test.ts` |
| `AUTH_SECRET` Rotation | Hoch | Spotify-Tokens, Share-Passwörter ungültig |
| Cross-Site Studio API | Hoch | `requireStudioApiAuth` — CSRF bei neuen Routes nicht vergessen |
| SQLite Skalierung | Mittel | Ein Writer; Backup während Schreibzugriff |
| RTX offline | Mittel | Jobs stauen; UX muss deferred Status zeigen |
| Embedding-Größe in SQLite | Mittel | `BrainChunk.embedding` als JSON |
| Mobile UI unvollständig | Mittel | Nicht alle Welt-Views haben `bottomNav` |
| Kein Kalender | Niedrig | Termin-Chaos bei vielen Verträgen/Sessions |
| Image Studio Speicher | Mittel | Duplikate Varianten → `UPLOADS_DIR` Wachstum |
| Windows + Linux Pfade | Mittel | `UWE_DATA_DIR` vs relative Pfade testen |

---

## 11. Welche Features schon vorhanden sind

- ✅ Welt-Wiki mit PageTypes, Content-Blocks, Wikilinks, Templates
- ✅ Asset-Bibliothek mit Upload, MIME, Seiten-Verknüpfung, Share-Links
- ✅ Sichtbarkeit dm_only / player_visible / public + Inspector + Undo
- ✅ Player Portal (öffentlich + auth) mit harten Security-Tests
- ✅ Player Preview (`?preview=player`, Preview-as-Player im Portal)
- ✅ Game Sessions mit Datum, Recaps, Seiten-Links
- ✅ Dungeon Cockpit (Hierarchie, Prep-Status, Room-View)
- ✅ 6×4 Label-Editor, Templates, Drucklisten, PDF/HTML/PNG Export
- ✅ DnD-KI-Generator mit Review/Apply (AI Runs, Proposals)
- ✅ Brain Store (Documents, Facts, Chunks, Embeddings, Links)
- ✅ Wissenstexte UI + `expand_knowledge` Brain-Action
- ✅ KI-Router (Auto/RTX/Cloud) mit Privacy-Enforcement
- ✅ RTX-Agent Integration + Windows Tray Tool
- ✅ Job-Queue (Mail, AI, Embedding, Import, Backup, Canon)
- ✅ Mail Center (Templates, Recipients, Compose, Logs)
- ✅ Soundboard (Local, YouTube, Spotify OAuth)
- ✅ Static HTML Export (player-safe)
- ✅ KnoteForge Import mit Preview
- ✅ Backup/Restore (API + CLI + Windows)
- ✅ Activity Log + Next Actions + Command Palette
- ✅ Daily Admin OS Basis: Today, Capture, Projects, Workshop, Contracts, Hardware, Life-Brain
- ✅ Mobile Bottom Nav + KI-Prompt Page + Global Capture FAB
- ✅ Settings UI (General, Worlds, Portal, Privacy, Storage, AI, Mail, Backup)
- ✅ CI: lint, typecheck, test, build (`ci.yml`)
- ✅ Docker Compose + Windows Installer
- ✅ Image Studio Phase 1 (Prompt-Generierung, Job-Queue, RTX/Cloud)
- ✅ Kalender Phase 1 (lokal, iCal/CalDAV/FamilyWall read-only)
- ✅ DnD API Phase 1 (Open5e, SRD-Monster, Beyond-Links)
- ✅ Agent Jobs (GitHub Actions / Cursor Cloud Dispatch)

---

## 12. Welche Features fehlen oder sind Phase 1 / unfertig

Siehe **[docs/FEATURE_MATURITY_MATRIX.md](FEATURE_MATURITY_MATRIX.md)** für den vollständigen Reifegrad.

Kurzfassung — **nicht** als fertig verkaufen:

| Feature | Echter Status |
|---------|---------------|
| **Image Studio** | Phase 1: Prompt-Generierung — kein Editor/Canvas |
| **Kalender** | Phase 1: lokal + read-only Feeds — CalDAV Write-back nicht in UI |
| **DnD API** | Open5e + SRD-Monster — kein Statblock-Import |
| **Agent Jobs** | Dispatch funktioniert — kein Completion-Callback |
| **Secrets/Reveal** | Backend + Tests — keine Studio-Editor-UI |
| **Import Undo** | Nicht vorhanden (nur Preview) |
| **Performance-Budget / Stress-Testwelt** | Nicht vorhanden |
| **Tag-Aufräumer** | Nicht vorhanden |

Weiterhin offen (Roadmap):

- ✅ **Studio DM-Login** — Session-Login (owner/admin/dm); `AUTH_REQUIRED=true` für Produktion
- ✅ **Image Studio Phase 2** — Inpaint-UI, Varianten-Batch, Seiten-Link
- ✅ **Kalender Phase 2** — Wochenansicht, Zwei-Wege-Sync, Feed-Passwort
- ✅ **Externe DnD-APIs** — Statblock-Import, Encounter-Builder
- ✅ **E2E Auth-Tests** — Playwright-Baseline im CI
- ✅ **PostgreSQL-Option** — dual-client + Baseline-Migration
- ✅ **Markdown/HTML Export** — `pnpm export:wiki`
- ❌ **Asset-Datei-Import** — Roadmap (README)
- ❌ **Vollständige Mobile-UI** für alle Welt-Unterseiten (Soundboard, Labels, Dungeons teils ohne Bottom Nav)
- ❌ **Capture Bild-Upload** — `file_image` Typ in DB, UI für Datei-Upload prüfen/ergänzen
- ❌ **Personal Brain Embeddings** — Life-Brain ohne Retrieval wie DnD-Brain
- ❌ **Reminder/Notifications** — keine Push/E-Mail für Termine

---

## 13. Empfohlene Implementierungsreihenfolge

Reihenfolge nach Abhängigkeiten, Risiko und vorhandener Basis:

1. **Fundament prüfen** — Migrationen auf Prod, `AUTH_SECRET`, `STUDIO_API_TOKEN`, CI grün
2. **Mobile UI Lücken** — `bottomNav` auf kritischen Welt-Views (Assets, Dungeons, Labels) — niedriges Risiko, hoher UX-Gewinn
3. **Capture `file_image` Upload** — DB-Typ existiert; Upload → Asset-Pipeline schließen
4. **Kalender v1** — Aggregation ohne neue Tabelle: Sessions + Contracts in `/today` + `/calendar`
5. **Image Studio v1** — Assets-Seite + Upload-API; Varianten in `metadata`; Label-Editor-Anbindung
6. **DnD API Integration** — externes Package, strikt dm_only, Generator-Actions erweitern
7. **Wissenstexte UX** — Brain-UI + `expand_knowledge` polieren, Embedding-Reindex-Jobs
8. **Cursor-Agent Jobs** — `JobType` erweitern, Runner, Admin-UI; parallel Doku in `docs/ai-brain-mail/`
9. **Life-Brain Retrieval** — Personal Brain KI-Kontext (Privacy: `personal-brain-privacy.test.ts`)
10. **PostgreSQL / Export-Formate** — wenn Self-Host-Skalierung nötig

---

## Tests

| Bereich | Dateien (Auswahl) |
|---------|-------------------|
| Visibility / Security | `visibility-security.test.ts`, `studio-security.test.ts`, `production-safety.test.ts` |
| Assets | `asset.test.ts` |
| Brain | `brain-store.test.ts`, `ai-brain.test.ts`, `privacy.test.ts` |
| DnD Generator | `dnd-generator.test.ts`, `generator-service.test.ts` |
| Dungeon | `dungeon-cockpit.test.ts` |
| Labels | `label-editor.test.ts`, `label-service.test.ts` |
| Jobs | `job-service.test.ts`, `rtx-deferred-jobs.test.ts` |
| Life Admin | `life-admin-service.test.ts`, `today-dashboard.test.ts` |
| Mail | `mail-service.test.ts`, `packages/mail/*.test.ts` |
| Portal | `share-access.test.ts`, `rate-limit.test.ts` |
| Integration | `scripts/integration-smoke.test.ts` |
| RTX Agent | `tools/uwe-rtx-agent/src/*.test.ts` |

Ausführen: `pnpm test` (inkl. Script-Tests).

---

## Dokumentation

| Dokument | Inhalt |
|----------|--------|
| `README.md` | Hauptdoku, RTX, Soundboard, Architektur |
| `docs/daily-admin-os.md` | Admin Cockpit Routen |
| `docs/dnd-generator-upgrade.md` | DnD-KI Aktionen |
| `docs/LABELS.md` | 6×4 Labeldruck |
| `docs/life-brain-privacy.md` | Life-Brain Privacy |
| `docs/PRODUCTION.md` | Deployment |
| `docs/ai-brain-mail/**` | KI/Mail/Job Implementierungspakete |
| `SECURITY.md`, `SECURITY_NOTES.md` | Security Checklist, KI-Datenschutz |
| `CHANGELOG.md` | Release Notes 0.1.0 |

---

## CI / GitHub Actions

| Workflow | Pfad | Steps |
|----------|------|-------|
| CI | `.github/workflows/ci.yml` | install → lint → prisma generate → typecheck → test → build:release |
| Windows Installer | `.github/workflows/windows-installer.yml` | Installer-Build |

Node 22 in CI, pnpm 10.12.1. Kein deploy-Workflow im Repo.

---

## Kalender / Termin-Logik (falls vorhanden)

- **GameSession.date** — einziges echtes Session-Datum; Dashboard zeigt „Nächste Session“
- **ContractExpense** — `nextPaymentDate`, `renewalDate`, `cancelByDate`, `billingDay` — Listen in `/contracts`
- **Kein** zentrales Event-Modell, **kein** Kalender-Widget, **kein** iCal/Reminder
- **Today** (`today-dashboard.ts`) — aggregiert Status, nicht Termine in Kalenderform

---

*Erstellt durch Repo-Audit-Agent. Keine Code-Features geändert — nur Analyse und dieses Dokument.*
