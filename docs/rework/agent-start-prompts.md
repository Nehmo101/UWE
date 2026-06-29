# UWE Hard UI/UX Reset — Agent Start Prompts

Diese Datei enthält die Copy-Paste-Start-Prompts für die Agents, die den Hard UI/UX Rework umsetzen. Grundlage ist `docs/rework/hard-ui-ux-reset-plan.md`. Wellenmodell: `1 → 4(5) → 1–2`.

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

## Wave 2 — Integration & Abschluss (1–2 Agents)

> Rolle: Du bist der Integrations-Agent (Welle 2) im UWE Hard UI/UX Rework. Lies `docs/rework/hard-ui-ux-reset-plan.md` (Phase 12, 13, 14) und integriere die Ergebnisse der Wellen 0–1.
>
> Scope:
> - Phase 12 Tests auf neue IA umstellen: `apps/studio/src/lib/studio-navigation.test.ts`, `mobile-nav.test.ts`, `apps/portal/src/lib/portal-navigation.test.ts`, `packages/auth/src/security/{route-policy,middleware}.test.ts`, `scripts/studio-route-auth.test.ts`, Security-Leak-Tests. Neue Tests gemäß Plan-Testliste.
> - Phase 13 Doku-Audit: `README.md`, `docs/ARCHITECTURE.md`, `docs/FEATURE_MATURITY_MATRIX.md`, `docs/ROADMAP.md`, `docs/design/new-ui-stack.md`, `docs/rework/hard-ui-ux-reset-plan.md`, `docs/cloudflare-current-setup.md`. Jede Datei unter `docs/` prüfen: keep/update/archive/delete (Constraints: docs-check-Pflichtdateien behalten, jede `.md` startet mit `#`, keine Tabs).
> - Phase 14 finale Validierung: `pnpm lint/typecheck/test:ci/build:release`, bevorzugt `pnpm quality`. Abschlussbericht: Branchname, neuer Stack, Shell-Struktur, Navigation, neu angebundene Features, UI-offene Features, Quick-Fix-Ergebnisse, Cloudflare-Änderungen, Tests/Build, Risiken, nächste Aufgaben.
>
> Branch `cursor/uwe-integration-<slug>`, finale PR (kein Draft, wenn CI grün).
