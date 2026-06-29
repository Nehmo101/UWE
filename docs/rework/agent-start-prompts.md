# UWE Hard UI/UX Reset — Agent Start Prompts

Diese Datei enthält die Copy-Paste-Start-Prompts für die Agents, die den Hard UI/UX Rework umsetzen. Grundlage ist `docs/rework/hard-ui-ux-reset-plan.md`. Wellenmodell: `1 → 4(5) → 4 → 1` (Wave 0 seriell, Wave 1 parallel, Wave 2 parallel, Abschluss-Orchestrator).

Leitsatz für alle Agents: **FUNKTIONEN BEHALTEN. ALTE OBERFLÄCHE ERSETZEN.** Kein Löschen von Prisma-Models, Services, API-Logik. Backend bleibt erhalten; nicht migrierte Feature-UIs werden als `legacy-ui-disconnected` dokumentiert und aus der aktiven Navigation entfernt.

## Gemeinsame Regeln (für jeden Agent)

- Zuerst lesen: `docs/rework/hard-ui-ux-reset-plan.md`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, relevante `.cursor/skills/`.
- Eigener Branch pro Agent (`cursor/uwe-<scope>-<slug>`), kleine Commits, häufig pushen, Draft-PR am Ende.
- Gate vor PR: `pnpm install --frozen-lockfile && pnpm quality` (mindestens `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build:release`).
- Business-Logik in `packages/`, nicht in Route-Handlern/Komponenten.
- Portal player-safe halten, keine `dm_only`-Leaks; Studio-APIs guarded lassen.
- Konfliktzonen nicht parallel anfassen: zentrale Navigation, Shells, `packages/auth/src/security/route-policy.ts`, geteilte Test-Dateien.

## Wave 0 — Fundament-Agent (seriell, blockierend)

> Rolle: Du bist der Fundament-Agent (Welle 0) für den UWE Hard UI/UX Rework im UWE-Repository.
>
> Lies zuerst `docs/rework/hard-ui-ux-reset-plan.md`, `AGENTS.md`, `CLAUDE.md`, `docs/design/design-v2-reference.md`, `.cursor/rules/`.
>
> Wichtigster Satz: FUNKTIONEN BEHALTEN. ALTE OBERFLÄCHE ERSETZEN. Kein Löschen von Prisma-Models, Services, API-Logik.
>
> Dein Scope = nur Welle 0 (Fundament). Liefere einen sauberen Vertrag, auf den die anderen Agents aufbauen:
> 1. Phase 1 — Neuer UI-Stack: Tailwind CSS, shadcn/ui-Primitives (Button, Card, Dialog, Dropdown, Tabs, Form, Input, Select, Sheet, Command, Toast/Sonner, Table, Alert/Empty/Error), Radix-Primitives, `lucide-react`, `class-variance-authority` + `clsx` + `tailwind-merge`, `@tanstack/react-table`, `@tanstack/react-query`, `react-hook-form` + `@hookform/resolvers`, `cmdk`, `@xyflow/react`. Brücke: bestehende `--uwe-*`/design-v2 Tokens ins Tailwind-Theme mappen, alte CSS nicht sofort löschen. Erstelle `docs/design/new-ui-stack.md`.
> 2. Phase 3 — Zentrale Navigation: `apps/studio/src/navigation/{studio-nav,world-nav,system-nav,organization-nav}.ts`, `apps/portal/src/navigation/portal-nav.ts`, `apps/rtx-connector-client/src/navigation/connector-nav.ts`. Gemeinsames `NavItem`-Schema (id, label, href, icon, group, section, permission, status, source, keywords). IA exakt wie im Plan.
> 3. Phase 4 — Shell-Architektur: `StudioShell`, `WorldShell`, `PortalShell`, `SystemShell`, `ModuleShell`, `SettingsShell` + geteilte Primitives (sidebar, topbar, breadcrumbs, context-panel, mobile-nav). Regeln: jede Seite nutzt eine Shell, keine Seite baut eigene Hauptnav, stabile linke Sidebar, kein wechselndes Welt-Menüband.
> 4. Phase 2 — Analyse-Doku: schreibe Analyse-Inhalte gemäß Plan (aktive Apps/Routen/Features, was bleibt, was ersetzt wird, `legacy-ui-disconnected`-Tabelle, Tests die alte UI erzwingen).
>
> Konfliktzonen, die DU besitzt: zentrale Nav, Shells, `tailwind.config`, `components/ui/*`. Fass `packages/auth/src/security/route-policy.ts` nicht an (gehört Welle 1 / System-Agent).
>
> Noch NICHT umsetzen: keine Quick Fixes, keine Detail-Seitenmigration, kein Portal/Cloudflare/Sessions/Dungeons. Migriere nur so viel wie nötig, um die Shells zu beweisen (z. B. `/today`).
>
> Definition of Done: Tailwind + `cn()` kompilieren in Studio und Portal; alle UI-Primitives existieren; Single-Source-Navigation pro App/Scope; alle 6 Shells existieren + dokumentiert; `docs/design/new-ui-stack.md` + Analyse-Doku vorhanden; Tests für zentrale Navigation (hrefs existieren, keine Duplikate); `pnpm lint/typecheck/test:ci/build:release` grün oder Restfehler konkret dokumentiert.
>
> Branch `cursor/uwe-ui-foundation-<slug>`, Draft-PR. Liefere am Ende: Branchname, neuer Stack, Shell-Struktur, Navigation, offene Punkte, nächste Schritte für Welle 1.

## Wave 1 — A1: Portal + Cloudflare

> Rolle: Du bist Agent A1 (Portal + Cloudflare) im UWE Hard UI/UX Rework. Lies `docs/rework/hard-ui-ux-reset-plan.md` (Phase 10, QF2, QF9) und baue auf dem Fundament aus Welle 0 auf (neue Shells, zentrale Navigation, UI-Stack).
>
> Scope:
> - Portal login-first machen (Phase 10): `apps/portal/app/page.tsx`, `apps/portal/app/portal/page.tsx`, `apps/portal/app/login/page.tsx`, `apps/portal/app/auth/worlds/*`, `apps/portal/app/worlds/*`, `apps/portal/src/navigation/portal-nav.ts`, neue `PortalShell`-Nutzung.
> - QF2: `/portal` darf nie in Studio NotFound landen. Studio bekommt einen defensiven `/portal`-Redirect zur konfigurierten Portal-URL. Nicht eingeloggt -> `/login`; eingeloggt -> `/auth/worlds`. Öffentlichen „Welten entdecken“-Hauptflow entfernen. Empty State ohne Weltmitgliedschaft.
> - QF9: Cloudflare via MCP prüfen/dokumentieren. Split-Hostnames bevorzugen (`studio.uweanddragons.org`, `portal.uweanddragons.org`). `docs/cloudflare-current-setup.md` erstellen. Env dokumentieren (PUBLIC_BASE_URL, STUDIO_PATH, PORTAL_PATH, NEXT_PUBLIC_STUDIO_URL, NEXT_PUBLIC_PORTAL_URL, AUTH_REQUIRED, PLAYER_PREVIEW_PUBLIC, TRUST_PROXY, CLOUDFLARE_TUNNEL). Cookies (Secure/SameSite/Proxy-Header) prüfen.
>
> Konfliktzone: `packages/auth/src/security/route-policy.ts` gehört A3. Liefere Policy-Änderungen als kleines, klar markiertes Delta und stimme dich mit A3 ab.
>
> Tests: Portal-Nav-Tests, Middleware-Tests, Link-Resolver-Tests, Security-Leak-Tests (Sichtbarkeit). DoD: `/`+`/portal` ohne Session -> Login; mit Session -> Meine Welten; kein Studio NotFound; `pnpm quality` grün.
>
> Branch `cursor/uwe-portal-cloudflare-<slug>`, Draft-PR.

## Wave 1 — A2: World Content (Sessions, Dungeons, Faction-Filter, Wiki-Kern)

> Rolle: Du bist Agent A2 (World Content) im UWE Hard UI/UX Rework. Lies `docs/rework/hard-ui-ux-reset-plan.md` (QF4, QF5, QF6, Phase 9) und baue auf Welle 0 auf.
>
> Scope:
> - QF4 Sessions: `apps/studio/app/worlds/[worldSlug]/sessions/new/page.tsx`, `apps/studio/app/session-actions.ts`, `packages/database` GameSessionService, `packages/calendar`. Zod-Validierung, verständliche Fehler, Kalender-Sync als optionaler Side-Effect (darf Erstellung nicht crashen). React Hook Form + Zod.
> - QF5 Dungeons: `apps/studio/app/worlds/[worldSlug]/dungeons/new/page.tsx`, `apps/studio/app/dungeon-actions.ts`, Dungeon-Service. Vereinheitlichung mit Wiki/Page-System (PageTypes dungeon/dungeon_level/room/encounter/trap/puzzle/loot/secret). Wizard: Dungeon -> Ebene -> Raum -> Encounter/Loot/Falle/Rätsel.
> - QF6 Faction/Typfilter: `apps/studio/app/worlds/[worldSlug]/page.tsx`, `[category]/[slug]/*`, NavCategory/PageType-Mapping. Typfilter als Filter innerhalb Wiki, kein Crash bei leeren Ergebnissen, Empty State.
> - Phase 9 Wiki-Kern: Seitenliste mit TanStack Table (Typfilter/Suche/Tags/Sichtbarkeit/Status/last changed), Detailseite mit Tiptap in neuer Shell, rechte Kontextleiste (Backlinks/ausgehende Links/related), `[[Wiki Links]]`, fehlende Seiten erkennen/erstellen, Broken Links, Verbindungsmatrix, Graph mit `@xyflow/react`, Text/Markdown -> Seite.
>
> Tests: Regression für Sessions-create, Dungeon-create, Room-create, Category-Mapping, Render `/worlds/<slug>/fraktionen`. DoD: Sessions/Dungeons/Faction-Filter funktionieren ohne Server Component Error; `pnpm quality` grün.
>
> Branch `cursor/uwe-world-content-<slug>`, Draft-PR.

## Wave 1 — A3: System (Navigation-Overview, Version, Host Control, Error-UI, Layout-404)

> Rolle: Du bist Agent A3 (System) im UWE Hard UI/UX Rework. Lies `docs/rework/hard-ui-ux-reset-plan.md` (QF1, QF8, QF13, QF14, Phase 7) und baue auf Welle 0 auf. Du bist Owner von `packages/auth/src/security/route-policy.ts`.
>
> Scope:
> - QF1 Layout-404: `apps/studio/app/api/dashboard-layout/[pageKey]/route.ts`, `route-policy.ts`, `useDashboardLayout.ts`. Repro + Fix: GET mit Session liefert JSON (kein 404), PUT speichert, ohne Auth 401/403. Regression-Tests in route-policy + middleware.
> - QF8 Version: Build-Metadata-Modul (version/commit/branch/builtAt/deployRunNumber), Anzeige in Studio-Sidebar/Footer, `apps/studio/app/system/version/page.tsx`, Portal-Footer; GitHub-Action mit Loop-Schutz (`[skip ci]`).
> - QF13 Host Control: `apps/studio/app/system/host-control/page.tsx` (Owner-only, Audit-Log, keine Secrets im Client): URLs, Auth Required, Cloudflare-Status, RTX-Token-Status (maskiert), AI/Ollama, Printer, Backup/Restore, DB-Migration-Status, Logs, Healthcheck, optional Restart/Update.
> - QF14 Error-UI: `apps/studio/app/error.tsx`, `not-found.tsx`, Portal-Pendants, zentrale Error-Komponenten. Owner-Diagnose (Route/User/Rolle/WorldSlug/Timestamp/Digest/Log-Hinweis) vs. spieler-sichere Meldung. APIs liefern strukturierte Fehlercodes.
> - Phase 7 Navigation-Overview: `apps/studio/app/system/navigation/page.tsx` + `apps/studio/src/navigation/inspect-navigation.ts` (Route-Scanner, Dead-Link/Legacy/Duplikat-Warnungen).
>
> Koordination: A1 (Portal) liefert ein Route-Policy-Delta; pflege es konsolidiert ein.
> DoD: Layout lädt/speichert ohne 404; Version sichtbar; Host Control owner-only ohne Secret-Leak; Error-UI ersetzt generische Box; Navigation-Overview zeigt Warnungen; `pnpm quality` grün.
>
> Branch `cursor/uwe-system-<slug>`, Draft-PR.

## Wave 1 — A4: RTX / Connector + Labeldruck

> Rolle: Du bist Agent A4 (RTX/Connector) im UWE Hard UI/UX Rework. Lies `docs/rework/hard-ui-ux-reset-plan.md` (QF7, QF10, Phase 11) und baue auf Welle 0 auf.
>
> Scope:
> - QF7 Ollama-Test ohne schwarzes CMD: `apps/rtx-connector-client/src-tauri/src/lib.rs` — ALLE Windows-Prozessstarts (inkl. `node`) über `CREATE_NO_WINDOW`. stdout/stderr capturen, Timeout, strukturiertes Ergebnis (ok/status/endpoint/message/stdout/stderr/triedPaths). UI nie nur „Unbekannter Fehler“.
> - QF10 Labeldruck über RTX: Connector-Capability `label_printing` (`packages/connector`, `tools/uwe-rtx-connector/src/*`), lokale Drucker erkennen, Print-Job-Queue (UWE Host erstellt Jobs, Connector verarbeitet). UI: `apps/studio/app/system/printers/page.tsx`, Welt -> Labels & Print (Druckerwahl, Vorschau, Queue, Status, Fehlerzustände).
> - Phase 11 Connector-Client-Rework: `apps/rtx-connector-client/src/navigation/connector-nav.ts`, `ConnectorShell`. Bereiche: Host-Verbindung, Runner/Ollama, Modelle, Drucker, Jobs, Logs, Diagnose.
>
> Tests: Connector-Capability-Test, Print-Queue-Service-Test, Diagnose-Rendering-Test. DoD: kein schwarzes CMD, echte Ollama-Diagnose, Drucker/Queue sichtbar; `pnpm quality` grün.
>
> Branch `cursor/uwe-rtx-connector-<slug>`, Draft-PR.

## Wave 1 — A5 (optional): Knowledge / Brain / Users

> Rolle: Du bist Agent A5 (Knowledge/Brain/Users) im UWE Hard UI/UX Rework. Lies `docs/rework/hard-ui-ux-reset-plan.md` (QF3, QF11, QF12) und baue auf Welle 0 auf.
>
> Scope:
> - QF11 `create_knowledge_text`: `packages/ai-brain`, `apps/studio/app/brain-actions.ts`, Welt -> Brain/Wissen + Import + Seite -> „Aus Text Wissen erzeugen“. Output: Titel/Zusammenfassung/strukturierter Text/erkannte NPCs-Orte-Fraktionen/Link-Vorschläge/Ziel-Seitentyp. Privacy-Guard: keine privaten Weltinhalte ungefragt an Cloud.
> - QF12 UWE KnowHow: `apps/studio/app/system/uwe-knowhow/page.tsx`, Doku-Indexer (README/docs/CHANGELOG/Feature-Matrix/Setup), durchsuchbar, getrennt vom Welt-Brain, Quelle + Update-Zeit sichtbar.
> - QF3 Membership/Portalzugriff: `packages/database` Membership, `packages/auth`, `apps/studio/app/admin/users/*`. Access-Prädikat (aktiver User, Rolle, Mitgliedschaft, Welt sichtbar), UI-Badges + „Portalzugriff prüfen“, strukturierte Fehler statt stiller 404.
>
> Tests: Action-Schema + Privacy-Guard, Indexer/Suche, Access-Prädikat. DoD: Wissenstext erstellbar/speicherbar, KnowHow durchsuchbar, Owner sieht Portalzugriff pro User; `pnpm quality` grün.
>
> Branch `cursor/uwe-knowledge-users-<slug>`, Draft-PR.

## Wave 2 — Orchestrator (koordiniert B1–B4, dann Abschluss)

> Rolle: Du bist der Wave-2-Orchestrator für den UWE Hard UI/UX Rework. Wave 0 (Fundament) und Wave 1 (Breite) sind abgeschlossen auf Branch `cursor/uwe-wave1-orchestrator-941c` (Draft-PR #298). Deine Aufgabe ist Abschluss, Integration und Verifikation — koordiniert über Subagents, nicht seriell alles selbst.
>
> Zuerst selbst lesen (Pflicht), bevor du Subagents startest:
> - `docs/rework/implementation-status.md` — Wave-1-Stand, Deferred/Wave-2-Tabelle, lokales QA-Rezept
> - `docs/rework/hard-ui-ux-reset-plan.md` (Phase 4/5/8/9/11/12/13/14, „Parallelization & Agent Cut")
> - `docs/rework/agent-start-prompts.md` (Wave-2-Abschnitte B1–B4 unten)
> - `docs/rework/route-feature-inventory.md`, `docs/design/new-ui-stack.md`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`
>
> Ausgangslage (nicht erneut anfassen, außer Regression):
> - Wave 0: UI-Stack, zentrale Navigation, Shells, System-Seiten (QF1, QF7–QF9, QF12–QF14, Phase 7)
> - Wave 1: QF2 Portal login-first, QF3 Portalzugriff-UI, QF10 Labeldruck, Teil-Migration (`/today`, `/worlds`, Wiki-Liste/Detail/Graph), Wiki-Kern-Komponenten, IA-Tests (1480 Tests, CI grün auf #298)
> - Bereits erledigt — NICHT reimplementieren: QF1–QF14 (soweit in `implementation-status.md` als done), Portal-Routing-Basis, `portal-access-service`, `label_printing`-Capability
>
> Verifiziere Ist-Stand auf Basis von PR #298 / Branch `cursor/uwe-wave1-orchestrator-941c`:
> `pnpm install --frozen-lockfile && pnpm --filter @uwe/database db:generate && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build:release`
>
> Starte Subagents parallel (max. 4), je einer pro Domäne. Gib jedem den passenden Abschnitt aus diesem Dokument (B1–B4) plus: „baue auf Wave-0/1-Fundament auf, alles additiv".
>
> Konfliktzonen serialisieren:
> - `packages/auth/src/security/route-policy.ts` → Owner **B3**; andere liefern Deltas
> - `apps/studio/src/navigation/*` → read-only für Subagents; Orchestrator pflegt Status
> - Legacy-Shell-Löschung (`WorldModuleShell`, `AdminModuleShell`, `StudioCockpitAppShell`) → erst nach Merge, wenn Referenzcount = 0
> - Geteilte Test-Dateien: B3 (route-policy/middleware/E2E), B4 (docs-check)
>
> Merge-Reihenfolge auf `cursor/uwe-wave2-orchestrator-<slug>`: B1 → B2 → B3 → B4. Nach jedem Merge: `pnpm lint && pnpm typecheck && pnpm test:ci`.
>
> QA — WICHTIG: Portal/Session-Flows über `scripts/e2e-servers.mjs` (Prod Build+Start). `/worlds/*` interaktiv über `next dev` lokal blockiert (siehe `implementation-status.md`). `.env`-Änderungen danach revertieren.
>
> Gate vor finalem PR: `pnpm quality` (oder mindestens lint → typecheck → test:ci → build:release → test:security → docs:check).
>
> Abschluss: Konsolidierter PR (ready wenn CI grün) + Bericht: migrierte Routen, E2E-Ergebnisse, Wiki-Edit-Stand, Legacy-Shell-Retirement, Tests/Build, Risiken, offene `legacy-ui-disconnected`-Items.
>
> Branch `cursor/uwe-wave2-orchestrator-<slug>`, Draft-PR bis CI grün.

## Wave 2 — B1: Welt-Routen (WorldModuleShell → WorldShell)

> Rolle: Du bist Agent B1 (Welt-Routen Shell-Migration) im UWE Hard UI/UX Rework Wave 2. Lies `docs/rework/implementation-status.md` (Deferred/Wave 2) und `docs/rework/hard-ui-ux-reset-plan.md` (Phase 4/5, 8/9). Baue auf Wave 0/1 auf (neue Shells, Wiki-Kern-Komponenten, zentrale Navigation).
>
> Scope — verbleibende `WorldModuleShell`-Seiten unter `apps/studio/app/worlds/**`:
> 1. `/worlds/[slug]/[category]/[slug]/edit` — Wiki-Edit (Priorität: Inkonsistenz zu bereits migrierter Detail-Seite)
> 2. Sessions: `/sessions`, `/sessions/new`, `/sessions/[id]`
> 3. Dungeons: `/dungeons/**` (Liste, Wizard, Ebenen, Räume)
> 4. Brain: `/brain/**`
> 5. Labels (nicht-print): `/labels/**` (RTX-Print bereits Wave 1)
> 6. Import, Inspector, Notes, Assets, Backup, AI-Runs, DnD-API, Soundboard, `/pages/new`
>
> Nutze `WorldShell`, bestehende Wiki-Komponenten (`WikiPageTable`, `WikiContextPanel`, `WikiTiptapViewer`, `PageHeader`, `BreadcrumbTrail`). Business-Logik in `packages/` belassen.
>
> Konfliktzone: `packages/auth/src/security/route-policy.ts` nicht anfassen. Zentrale Nav (`apps/studio/src/navigation/*`) read-only. Keine Portal-, Admin- oder Daily-Admin-Routen.
>
> Regel: Alte `WorldModuleShell` erst entfernen, wenn alle zugehörigen Seiten auf `WorldShell` verifiziert sind (Löschung macht der Orchestrator).
>
> Tests: Regression für migrierte Routen (Render-Smoke, bestehende Session/Dungeon-Tests dürfen nicht brechen). DoD: Migrierte Routen auf `WorldShell`; `pnpm lint/typecheck/test:ci/build:release` grün.
>
> Branch `cursor/uwe-wave2-world-shells-<slug>`, Draft-PR.

## Wave 2 — B2: Daily Admin OS + Organisation (StudioCockpitAppShell → StudioShell)

> Rolle: Du bist Agent B2 (Daily Admin OS Shell-Migration) im UWE Hard UI/UX Rework Wave 2. Lies `docs/rework/hard-ui-ux-reset-plan.md` (Phase 4/5, Daily Admin OS) und `docs/daily-admin-os.md`. Baue auf Wave 0/1 auf (`/today` bereits auf `StudioShell`).
>
> Scope — Routen noch auf `StudioCockpitAppShell` oder verstreute Legacy-Shells:
> - `/capture`, `/capture/[id]`
> - `/projects`, `/workshop/**`, `/contracts`, `/hardware`
> - `/life-brain/**`
> - `/calendar`, `/mail/**`, `/jobs`, `/image-studio/**`
> - `/search`, `/templates/**`
> - Organisation (falls noch Legacy): `/brain` (global), `/ai`, `/backup`
>
> Ziel-Shell: `StudioShell` + `PageHeader`/`BreadcrumbTrail` (wie `/today`). Mobile-Nav weiter aus Nav-Contract (`apps/studio/src/navigation/studio-nav.ts`).
>
> Konfliktzone: Keine Welt-Routen (B1), keine Admin/System-Routen (B3), kein Portal, keine `route-policy.ts`. Zentrale Nav read-only.
>
> DoD: Alle genannten Routen auf neuer Shell; keine Daily-Admin-Funktion verloren; `pnpm quality` grün.
>
> Branch `cursor/uwe-wave2-daily-admin-shells-<slug>`, Draft-PR.

## Wave 2 — B3: Admin/System-Shells + E2E + route-policy

> Rolle: Du bist Agent B3 (Admin/System + E2E) im UWE Hard UI/UX Rework Wave 2. Lies `docs/rework/implementation-status.md` (Portal E2E, route-policy deferred) und `docs/rework/hard-ui-ux-reset-plan.md` (Phase 10, 12). Baue auf Wave 1 QF2 auf. **Du bist Owner von `packages/auth/src/security/route-policy.ts` in Wave 2.**
>
> Scope:
> - Admin-Routen `apps/studio/app/admin/**` von `AdminModuleShell` → `SystemShell`/`SettingsShell`
> - System-Routen noch auf Legacy: `/system`, `/system/rtx-connector` (printers/navigation/version/cloudflare/host-control bereits Wave 0/1)
> - Portal E2E: `scripts/e2e-servers.mjs` — Playwright-Login; `/`+`/portal` ohne Session → Login; mit Session → `/auth/worlds`; Studio `/portal`-Redirect; kein Studio NotFound
> - Optional (nur wenn E2E Findings): login-first Portal-Regressionstests in `packages/auth/src/security/route-policy.test.ts` + `middleware.test.ts`
>
> QA-Pflicht: Prod-E2E-Harness (`scripts/e2e-servers.mjs`), NICHT `next dev` für Auth/Session-Flows.
>
> Konfliktzone: Keine Welt-Routen (B1), keine Daily-Admin-Routen (B2). Andere Agents liefern route-policy-Deltas als kommentiertes Snippet.
>
> DoD: Admin auf `SystemShell`; E2E grün oder konkrete Failures dokumentiert; route-policy-Tests ergänzt falls nötig; `pnpm quality` grün.
>
> Branch `cursor/uwe-wave2-admin-e2e-<slug>`, Draft-PR.

## Wave 2 — B4: RTX Connector Client + Label-Hardware-Doku + Docs-Audit

> Rolle: Du bist Agent B4 (RTX Client + Docs) im UWE Hard UI/UX Rework Wave 2. Lies `docs/rework/hard-ui-ux-reset-plan.md` (Phase 11, 13) und `docs/rework/implementation-status.md` (QF10 Hardware-E2E offen). Baue auf Wave 1 QF10 (`label_printing`) auf.
>
> Scope:
> - Phase 11 Connector-Client-Rework: `apps/rtx-connector-client/**` — `ConnectorShell`, `connector-nav.ts` IA (Host-Verbindung, Runner/Ollama, Modelle, Drucker, Jobs, Logs, Diagnose)
> - QF10 Hardware-Doku: RTX-Host-Setup für echten Druck (`UWE_CONNECTOR_PRINTERS`, `UWE_CONNECTOR_PRINT_CMD`, CUPS) — in bestehende Connector-/Hosting-Docs integrieren, keine Secrets
> - Phase 13 Docs-Audit (Pflicht + Kern): `README.md`, `docs/ARCHITECTURE.md`, `docs/FEATURE_MATURITY_MATRIX.md`, `docs/ROADMAP.md`, `docs/design/new-ui-stack.md`, `docs/rework/implementation-status.md` (Wave-2-Fortschritt)
> - `pnpm docs:check` muss grün bleiben
>
> Konfliktzone: Keine Studio-Welt-Seiten (B1), keine `route-policy.ts` (B3). Zentrale Nav in Studio/Portal nicht anfassen; `connector-nav.ts` gehört dir.
>
> DoD: Connector-Client auf neuer Shell-IA; Docs auf neuen Stack/IA aktualisiert; `pnpm docs:check` + `pnpm quality` grün.
>
> Branch `cursor/uwe-wave2-rtx-docs-<slug>`, Draft-PR.

## Wave 2 — Abschluss (Orchestrator, nach B1–B4-Merge)

> Rolle: Du bist der Abschluss-Orchestrator nach Wave-2-Subagents. Integriere B1–B4 auf `cursor/uwe-wave2-orchestrator-<slug>`.
>
> Scope:
> - Legacy-Shells löschen wenn Referenzcount = 0: `WorldModuleShell`, `AdminModuleShell`, `StudioCockpitAppShell`, `WorldCockpitShell`
> - `legacy-ui-disconnected`-Einträge in `implementation-status.md` bereinigen
> - Phase 14 finale Validierung: `pnpm quality`
> - PR #298 auf ready setzen oder neuen Wave-2-PR gegen `main` (kein Draft wenn CI grün)
> - Abschlussbericht: migrierte Routen, E2E-Ergebnisse, Wiki-Edit, Legacy-Retirement, Testcount, Risiken, verbleibende `legacy-ui-disconnected`-Features

## Wave 3 — Orchestrator (koordiniert C1–C4, dann Abschluss)

> Rolle: Du bist der Wave-3-Orchestrator für den UWE Hard UI/UX Rework. Wave 0–2 sind auf `main` (#297–#299). Abschluss: Legacy-Oberflächen, Portal-Polish, Wiki-Feinschliff, Phase-14-Validierung.
>
> Siehe `docs/rework/implementation-status.md` (Wave 3 shipped) und PR #303 (Legacy-Shell-Löschung + Docs).

## Wave 4 — Orchestrator (Abschluss design-v2, Auth-UI, E2E, legacy-ui-disconnected)

> Rolle: Du bist der **Wave-4-Orchestrator** für den UWE Hard UI/UX Rework. Wave 0–3 sind abgeschlossen und auf `main` gemergt (#297–#299, #300–#304, #303). Deine Aufgabe ist der **Programm-Abschluss**: verbleibende design-v2-Brücke abbauen, Auth-Oberflächen vereinheitlichen, E2E-Debt bereinigen, optional RTX-Label-E2E — koordiniert über Subagents, nicht seriell alles selbst.
>
> Zuerst selbst lesen (Pflicht), bevor du Subagents startest:
>
> - `docs/rework/implementation-status.md` — Wave-3-Stand, **Deferred / Wave 4 recommendations**
> - `docs/rework/hard-ui-ux-reset-plan.md` (Phase 10, 14, „Parallelization & Agent Cut")
> - `docs/rework/agent-start-prompts.md` — dieses Dokument (Wave-4-Abschnitte D1–D4)
> - `docs/rework/route-feature-inventory.md` — `legacy-ui-disconnected`-Tabelle
> - `docs/design/new-ui-stack.md`
> - `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`
>
> Ausgangslage (nicht erneut anfassen, außer Regression):
>
> - Alle aktiven Produkt-Routen auf neuen Shells (`StudioShell`, `WorldShell`, `SystemShell`, `PortalShell`, `ConnectorShell`)
> - Legacy App-Shells gelöscht: `StudioAppShell*`, `PortalAppShell`, `PortalGuestShell`, `PortalPublicShell`
> - Portal Login teilweise auf `PortalLoginForm` (app-lokal); Studio Auth-Seiten nutzen noch `@uwe/shared-ui` `AuthPageLayout`/`LoginForm`
> - `body[data-uwe-design-v2]` + `packages/shared-ui` (`uwe-v2.css`, `shells-v2/*`) noch als CSS-Brücke aktiv
> - E2E-Debt: `e2e/portal-shell.spec.ts` referenziert noch `.uwe-v2-shell`; `e2e/studio-settings.spec.ts` ist `test.skip`
>
> Verbleibender Wave-4-Scope:
>
> | Bereich | Ist | Ziel |
> |---------|-----|------|
> | Studio `/login`, `/forgot-password`, `/reset-password`, `/setup` | `AuthPageLayout` (shared-ui) | App-UI-Primitives + schlanke Auth-Layout-Komponente |
> | Studio `/account/**` | teils `AuthPageLayout` innerhalb `SystemShell` | Card-only, kein verschachteltes AuthPageLayout |
> | Portal Auth (falls noch shared-ui) | `PortalLoginForm` prüfen | vollständig Tailwind/Card, keine `authClasses` |
> | design-v2 Bridge | `isDesignV2Enabled`, `data-uwe-design-v2`, `shells-v2/*` | schrittweise ref=0, dann löschen |
> | E2E | veraltete Selektoren, skipped Tests | auf neue Shell-Selektoren, alle grün |
> | Label-Druck E2E | CI-Stubs | optional: CUPS-Stubs erweitern oder dokumentierte Manual-QA |
> | `legacy-ui-disconnected` `/worlds/*` | Redirect/Backend intact | Entscheidung: endgültig entfernen ODER dokumentiert behalten |
>
> Vorgehen — du als Orchestrator:
>
> 1. Verifiziere Ist-Stand auf `main`:
>    ```bash
>    pnpm install --frozen-lockfile
>    pnpm --filter @uwe/database db:generate
>    pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build:release
>    ```
> 2. Erstelle Branch `cursor/uwe-wave4-orchestrator-<slug>` von `main`.
> 3. Starte Subagents parallel (max. 4):
>
>    **D1 — Studio Auth-UI** (`cursor/uwe-wave4-studio-auth-<slug>`)
>    Scope: Studio `/login`, `/forgot-password`, `/reset-password`, `/setup`, `/account/**` — weg von `AuthPageLayout`, hin zu `Card`/Form-Primitives wie Wave 3 Account-Muster. Keine Business-Logik ändern.
>
>    **D2 — design-v2 CSS Retirement** (`cursor/uwe-wave4-design-v2-css-<slug>`)
>    Scope: Referenz-Scan für `shells-v2/*`, `PortalShellV2`, `isDesignV2Enabled`, `data-uwe-design-v2`. Nur löschen wenn ref=0. `packages/shared-ui/src/auth/*` schrittweise auf Tailwind-taugliche Primitives umstellen oder App-lokale Auth-Komponenten. Owner von `app/layout.tsx` design-v2-Flag.
>
>    **D3 — E2E Bereinigung** (`cursor/uwe-wave4-e2e-<slug>`)
>    Scope: `e2e/portal-shell.spec.ts` auf `PortalShell`-Selektoren; `e2e/studio-settings.spec.ts` ent-skip; Portal+Studio Auth-Flows via `scripts/e2e-servers.mjs`. Optional Label-E2E-Stubs in CI.
>
>    **D4 — legacy-ui-disconnected + Docs** (`cursor/uwe-wave4-legacy-docs-<slug>`)
>    Scope: `/worlds/*` Public-Discovery — Produktentscheidung umsetzen (entfernen vs. dokumentiert behalten). `implementation-status.md` Wave-4-Abschluss, `README`/`ROADMAP`/`FEATURE_MATURITY_MATRIX`. `pnpm docs:check`.
>
> 4. Konfliktzonen serialisieren:
>
>    | Zone | Owner | Andere |
>    |------|-------|--------|
>    | `packages/shared-ui/src/auth/*` | D2 | D1 liefert App-Migration zuerst |
>    | `apps/studio/app/layout.tsx`, `apps/portal/app/layout.tsx` | D2 | read-only für D1/D3 |
>    | `e2e/**` | D3 | D1 koordiniert Auth-Selektoren |
>    | `docs/rework/implementation-status.md` | D4 / Orchestrator | — |
>    | `packages/auth/src/security/route-policy.ts` | Orchestrator | nur bei `/worlds`-Entfernung |
>
> 5. Merge-Reihenfolge: D1 → D2 → D3 → D4. Nach jedem Merge: `pnpm lint && pnpm typecheck && pnpm test:ci`.
>
> 6. Nach D1–D4: `pnpm quality`, PR ready (kein Draft wenn CI grün), Phase-14-Finale in `implementation-status.md`.
>
> QA — WICHTIG:
> - Auth/Session: `scripts/e2e-servers.mjs` (Production Build+Start)
> - Portal Spieler: `aman@uwe.local` / `uwe-dev`; Studio: `dm@uwe.local` / `uwe-dev`
> - `.env`-Änderungen für lokale QA danach revertieren
>
> Leitsatz: **FUNKTIONEN BEHALTEN, ALTE OBERFLÄCHE ERSETZEN.** design-v2/CSS erst entfernen wenn ref=0 und E2E grün.
>
> Branch `cursor/uwe-wave4-orchestrator-<slug>`, Draft-PR bis CI grün.

## Wave 4 — D1: Studio Auth-UI

> Rolle: Du bist Agent D1 (Studio Auth-UI) im UWE Hard UI/UX Rework Wave 4. Baue auf Wave 3 auf (`SystemShell`, Card-Primitives).
>
> Scope: `apps/studio/app/login/page.tsx`, `forgot-password`, `reset-password`, `setup`, `/account/**` — ersetze `@uwe/shared-ui` `AuthPageLayout`/`AuthCard` durch app-lokale Auth-Layouts mit `Card`, `Input`, `Button`, `Label`. Form-Logik in shared-ui (`LoginForm` etc.) nur anfassen wenn nötig; bevorzuge dünne Wrapper in Studio.
>
> Konfliktzone: `packages/shared-ui/src/auth/*` gehört D2. Keine route-policy-Änderungen.
>
> DoD: Studio Auth-Seiten ohne `AuthPageLayout`; `pnpm quality` grün; E2E-Selektoren an D3 liefern.
>
> Branch `cursor/uwe-wave4-studio-auth-<slug>`, Draft-PR.

## Wave 4 — D2: design-v2 CSS Retirement

> Rolle: Du bist Agent D2 (design-v2 CSS Retirement) im UWE Hard UI/UX Rework Wave 4.
>
> Scope: Referenz-Scan + schrittweises Löschen von `shells-v2/*`, `PortalShellV2`-Exports (wenn ref=0), Reduktion von `data-uwe-design-v2`-Abhängigkeit. Migriere verbleibende shared-ui Auth-Komponenten auf token-basierte Klassen oder markiere als deprecated mit ref=0-Ziel.
>
> Konfliktzone: App-Auth-Seiten (D1) zuerst; Layout-Flags koordinieren.
>
> DoD: Klare ref=0-Liste; gelöschte Dateien dokumentiert; keine visuelle Regression auf migrierten Seiten; `pnpm quality` grün.
>
> Branch `cursor/uwe-wave4-design-v2-css-<slug>`, Draft-PR.

## Wave 4 — D3: E2E Bereinigung

> Rolle: Du bist Agent D3 (E2E) im UWE Hard UI/UX Rework Wave 4.
>
> Scope: `e2e/portal-shell.spec.ts` (keine `.uwe-v2-shell`-Selektoren), `e2e/studio-settings.spec.ts` (ent-skip), ggf. Label-Print-Stubs. Harness: `scripts/e2e-servers.mjs`.
>
> DoD: Alle Shell-E2E grün oder begründet skipped; `pnpm test:e2e` bzw. CI-Job grün.
>
> Branch `cursor/uwe-wave4-e2e-<slug>`, Draft-PR.

## Wave 4 — D4: legacy-ui-disconnected + Docs

> Rolle: Du bist Agent D4 (Legacy + Docs) im UWE Hard UI/UX Rework Wave 4.
>
> Scope: Portal `/worlds/*` legacy-ui-disconnected — Entfernung oder finale Dokumentation. `implementation-status.md` Wave-4-Abschluss, Kern-Docs, `pnpm docs:check`.
>
> DoD: `legacy-ui-disconnected`-Tabelle final; Programm-Abschluss vs. bewusst offene Items dokumentiert.
>
> Branch `cursor/uwe-wave4-legacy-docs-<slug>`, Draft-PR.
