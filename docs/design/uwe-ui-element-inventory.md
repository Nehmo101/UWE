# UWE UI Element Inventory

**Stand:** 2026-06-24 · **Scope:** Alle Routen aus `uwe-qa-urls.md` (Studio + Portal + Legacy)  
**Methode:** Code-Verifikation (Shell-Komponenten, `mobile-nav.ts`, Page-TSX, CSS-Grep) — keine geratenen Werte  
**Design V2:** `NEXT_PUBLIC_UWE_DESIGN_V2` default **on** → Shells rendern `StudioShellV2` / `PortalShellV2` wenn aktiv

---

## Executive Summary

### Top defects by severity (Ist-Stand nach View-Polish #226–#230 + WP 1.1)

| Sev | Defect | Betroffene Routen | Status |
|-----|--------|-------------------|--------|
| **P0** | ~~Graph-Hintergrund / SVG-Höhenfalle~~ | Wiki-Session-Detail | ✅ Behoben (#226–#227) |
| **P0** | ~~KI-Panel roter Fehler bei offline/Mock~~ | Wiki-Detail, `/ai` | ✅ Behoben (#228) |
| **P1** | `.uwe-table-sub` fehlte in CSS (Ghost-Klasse) | Mail, Backup, Labels, Soundboard, Import | ✅ **WP 1.1** |
| **P1** | `/worlds` Bottom-Nav-Tab „Welten“ nicht aktiv | `/worlds` | ✅ **WP 1.1** |
| **P1** | Bottom-Nav-Label 0.58 rem @ ≤430 px (Kontrast/Lesbarkeit) | Alle Studio/Portal Mobile-Routen | ✅ **WP 1.1** (0.65 rem) |
| **P1** | Doppelte `.uwe-badge`-Basisdefinition überschrieb Padding/Radius | Global | ✅ **WP 1.1** |
| **P1** | ~120 verbleibende Hex-Werte in `uwe.css` (Parchment-Overrides, Label-Editor, Theme-Picker-Swatches) | Global, v. a. helle Themes | ⏳ WP 1.4 |
| **P1** | Badge-Duplikation `.uwe-badge-*` vs `.wiki-badge-*` | Wiki Studio + Portal | ⏳ WP 1.5 |
| **P2** | Portal `data-theme` nicht aus Studio-Settings synchronisiert | Portal alle Routen | ⏳ Phase 2 |
| **P2** | Landing `/` ohne Mobile Bottom Nav | Portal + Studio Root | By design (Auth-Shell) |
| **P2** | Sidebar/Filter-Sheet ohne Focus Trap | Mobile ≤960 px | ⏳ Phase 3 |

### Inventory stats

| Metrik | Wert |
|--------|------|
| QA-Routen abgedeckt (UI) | **53** (+ 5 API-Smoke-URLs dokumentiert) |
| Shell-Typen | 8 (V2 Shell, Module, World, Cockpit, Auth, Landing, Share-Gate, Redirect) |
| Defect backlog Einträge | **18** (3 P0 erledigt, 7 P1 offen/teilweise, 8 P2) |
| Quick fixes in WP 1.1 | **5 implementiert**, **4 deferred** (siehe unten) |

---

## Shell-Referenz (Code-verifiziert)

| Shell | Datei | Bottom Nav | Sidebar | Kontext-Spalte |
|-------|-------|------------|---------|----------------|
| **StudioShellV2** | `packages/shared-ui/src/design-v2/shells/StudioShellV2.tsx` | Prop `bottomNav` | Prop `sidebar` | Prop `context` |
| **StudioShell** (Legacy) | `packages/shared-ui/src/StudioShell.tsx` | Prop `bottomNav` | Prop `sidebar` | Prop `context` |
| **AdminModuleShell** | `apps/studio/components/AdminModuleShell.tsx` | `studioGlobalBottomNav()` default `"more"` | Unified IA via `StudioAppShellV2` | Optional |
| **StudioCockpitAppShell** | `apps/studio/components/StudioCockpitAppShell.tsx` | Explizit (z. B. `/today`) | Unified + Rail | Optional |
| **WorldModuleShell** | `apps/studio/components/WorldModuleShell.tsx` | **`studioWorldBottomNav()` immer** | Unified + Welt-Nav | Optional |
| **WorldCockpitShell** | `apps/studio/components/WorldCockpitShell.tsx` | Via WorldModuleShell | Cockpit-Modus | Optional |
| **StudioAppShell** | `apps/studio/components/StudioAppShell.tsx` | Prop | Sectioned Nav | Optional |
| **PortalShellV2** | `packages/shared-ui/src/design-v2/shells/PortalShellV2.tsx` | Prop `bottomNav` | Prop `sidebar` | — |
| **PortalPublicShell** | `apps/portal/src/components/PortalPublicShell.tsx` | Prop (Gast-Wiki) | Sections oder custom | — |
| **PortalAppShell** | `apps/portal/src/components/PortalAppShell.tsx` | Prop (Auth-Welten) | Welt + Global Nav | — |
| **PortalGuestShell** | `apps/portal/src/components/PortalGuestShell.tsx` | Optional | Share-Gate Nav | — |
| **LoginForm / AuthPageLayout** | `@uwe/shared-ui/auth` | Nein | Nein | — |
| **UweLandingPage** | `packages/shared-ui/src/auth/UweLandingPage.tsx` | Nein | Brand-Panel | — |

**Mobile Bottom Nav Breakpoints:** sichtbar `@media (max-width: 960px)` (`.uwe-bottom-nav` in `uwe.css`).

**Studio Global Tabs:** Heute · Leben · Welten · KI · Mehr (`apps/studio/src/lib/mobile-nav.ts`)  
**Studio World Tabs:** Übersicht · Seiten · Suche · Inspektor · Mehr (pro `worldSlug`)  
**Portal Public World Tabs:** Start · Suche · Graph · Welten · Menü  
**Portal Auth World Tabs:** Welten · Start · Sessions · Handouts · Account · Mehr

---

## Health & Auth (Smoke — kein App-Shell)

| Route | Shell | Nav | Primary UI | States | Mobile bottomNav | Theme issues |
|-------|-------|-----|------------|--------|------------------|--------------|
| `/api/health/public` | — | — | JSON | — | — | — |
| `/api/health` (Portal) | — | — | JSON | — | — | — |
| `/studio/api/health` | — | — | JSON | — | — | — |
| `/studio/login` | `LoginForm` (`variant="studio"`) | — | Auth-Form, Dev-Seed | Error via Form | Nein | Studio-Auth-Tokens |
| `/studio/api/brain/run` (ohne Auth) | — | — | 401/403 | — | — | — |

---

## Studio — Heute

| Route | Shell | Nav elements | Primary UI | Known states | Mobile bottomNav | Theme issues |
|-------|-------|--------------|------------|--------------|------------------|--------------|
| `/today` | `StudioCockpitAppShell` → **StudioShellV2** (cockpit) | Rail + Unified Sidebar (Heute…Admin) + Bottom **Heute** aktiv | `TodayDashboardClient`, Stat-Grid, Kalender/Mail/Projekte-Karten, `HealthBadge` | Empty: „Keine Termine…“ (`uwe-dashboard-muted`); Loading: SSR | **Ja** — `studioGlobalBottomNav("today")` | V2-Karten OK; Cockpit-Footer |
| `/studio` | Redirect → `/today` | — | — | — | — | — |

**Dateien:** `apps/studio/app/today/page.tsx`, `TodayDashboardClient.tsx`

---

## Studio — Welten

| Route | Shell | Nav elements | Primary UI | Known states | Mobile bottomNav | Theme issues |
|-------|-------|--------------|------------|--------------|------------------|--------------|
| `/worlds` | `AdminModuleShell` → StudioShellV2 | Unified Sidebar · Sektion **Welten** | `CreateWorldForm`, Weltliste-Links, `EmptyState` | Empty: „Noch keine Welten“ | **Ja** — Tab **Welten** aktiv (`bottomNav="search"`) | — |
| `/search` | AdminModuleShell | Sidebar + `GlobalSearchForm` in TopBar | `SearchFilterBar`, `SearchResultsList`, Filter-Sidebar | Empty: keine Treffer | **Ja** — Tab Welten/Suche | Filter-Sheet Badge (tokenisiert WP 1.1) |
| `/templates` | AdminModuleShell | Sidebar **Wissen** | Template-Grid, Quick-Create | Empty möglich | Ja (Mehr aktiv) | Template-Cards auf Tokens |
| `/templates/new`, `/templates/[id]` | AdminModuleShell | Sidebar | Formulare, Template-Detail | — | Ja | — |
| `/worlds/terra/dashboard` | `WorldCockpitShell` → WorldModuleShell | Welt-Nav + Unified Sidebar | KPI-Cards, Kampagnen-Übersicht | Seed-abhängig | **Ja** — `studioWorldBottomNav` Tab **Übersicht** | Cockpit-Modus |
| `/worlds/terra` | WorldModuleShell | Welt-Nav: Seiten aktiv | Seitenliste, Kampagnenfilter (`WorldCampaignSidebar`), Suche | Empty: keine Seiten | **Ja** — Tab **Seiten** | — |
| `/worlds/terra/sessions` | WorldModuleShell | Welt-Nav: Sessions | Session-Liste, Links zu Detail | Empty-Liste | **Ja** | — |
| `/worlds/terra/inspector` | WorldModuleShell | Welt-Nav: Inspektor | Leak-Findings, Fix-Actions | Empty: OK-Zustand | **Ja** — Tab **Inspektor** | — |
| `/worlds/terra/brain` | WorldModuleShell | Welt-Nav: Brain | Brain-Einträge, Facts | Empty | **Ja** | — |
| `/worlds/terra/[cat]/[slug]` | WorldModuleShell via `StudioWikiPageView` | Welt-Nav + Kontext-Sidebar | `WikiContent`, `GraphRelationList`, Share/KI collapsibles | Empty Backlinks; Offline-KI ruhig | **Ja** — Tab **Seiten** | Graph auf Tokens (#226) |
| `/worlds/terra/[cat]/[slug]/edit` | WorldModuleShell | Kontext-Nav | Editor-Form, Blöcke, Sticky Actions | Validation errors | **Ja** | Sticky action bar tokenized |

**Weitere Welt-Routen (nicht in QA-Liste, gleiches Muster):** assets, backup, graph, import, labels/*, soundboard, dungeons/*, notes, ai-runs/*, dnd-api, pages/new — alle **`WorldModuleShell` + `studioWorldBottomNav`**.

**Dateien:** `WorldModuleShell.tsx` Z.88–133 (bottomNav), `world-nav.ts`, `StudioWikiPageView.tsx`

---

## Studio — Leben

| Route | Shell | Nav elements | Primary UI | Known states | Mobile bottomNav | Theme issues |
|-------|-------|--------------|------------|--------------|------------------|--------------|
| `/capture` | AdminModuleShell | Sidebar **Leben** | `QuickCaptureForm`, Inbox-Liste, `CaptureImageUpload` | Empty: `EmptyState` | **Ja** — Tab **Leben** | FAB hidden on `/capture` |
| `/capture/[id]` | AdminModuleShell | — | Capture-Detail | — | Ja — Leben | — |
| `/projects` | AdminModuleShell | Sidebar Leben | Projekt-Karten, Status | Empty | Ja (Mehr) | — |
| `/contracts` | AdminModuleShell | Sidebar Leben | Vertrags-Tabelle, Fristen | Empty | Ja | — |
| `/hardware` | AdminModuleShell | Sidebar Leben | Homelab-Karten, `SystemHubBanner`, `HostUpdatePanel` | Empty hardware list | Ja | Banner → System-Hub |

---

## Studio — Werkstatt

| Route | Shell | Nav elements | Primary UI | Known states | Mobile bottomNav | Theme issues |
|-------|-------|--------------|------------|--------------|------------------|--------------|
| `/workshop` | AdminModuleShell | Sidebar **Werkstatt** | Modul-Übersicht, Links | — | Ja | — |
| `/workshop/rental`, `/recipes`, `/print-profiles`, `/[id]` | AdminModuleShell | Werkstatt | Domain-Forms/Listen | Empty | Ja | — |

---

## Studio — Wissen

| Route | Shell | Nav elements | Primary UI | Known states | Mobile bottomNav | Theme issues |
|-------|-------|--------------|------------|--------------|------------------|--------------|
| `/life-brain` | AdminModuleShell | Sidebar **Wissen** | Dokument-/Fact-Listen, Suche | Empty | Ja | Studio-only |
| `/life-brain/documents/[id]`, `/facts/[id]` | AdminModuleShell | — | Detail-Ansichten | — | Ja | RTX-only context |
| `/brain` | AdminModuleShell | Sidebar Wissen | Global Brain Store Liste | Empty | Ja | — |

---

## Studio — Medien

| Route | Shell | Nav elements | Primary UI | Known states | Mobile bottomNav | Theme issues |
|-------|-------|--------------|------------|--------------|------------------|--------------|
| `/image-studio` | AdminModuleShell | Sidebar **Medien** | Projekt-Grid, Job-Status | Empty | Ja | — |
| `/image-studio/[projectId]`, `/edit` | AdminModuleShell | — | Job-Form, Editor | failed-Status | Ja | — |
| `/mail` | AdminModuleShell | Sidebar Medien | Postfach-Tabelle (`.uwe-table*`) | Empty inbox | Ja | `.uwe-table-sub` fixed |
| `/mail/compose` | AdminModuleShell | — | Compose-Form | — | Ja | — |
| `/calendar` | AdminModuleShell | Sidebar Medien | Wochen-/Monats-Grid | Empty | Ja | — |

---

## Studio — KI

| Route | Shell | Nav elements | Primary UI | Known states | Mobile bottomNav | Theme issues |
|-------|-------|--------------|------------|--------------|------------------|--------------|
| `/ai` | AdminModuleShell | Sidebar **KI** | `MobileAiPromptPanel` / Chat | Offline: gedämpfter Hinweis; Access denied message | **Ja** — Tab **KI** | — |
| `/admin/ai-prompt` | Redirect → `/ai` | — | — | — | — | — |
| `/admin/ai-prompt?world=…` | Redirect → `/ai?world=…` | — | — | — | — | — |
| `/admin/reviews` | AdminModuleShell | Sidebar KI/Admin | Review-Liste | Empty | Ja | — |

---

## Studio — System

| Route | Shell | Nav elements | Primary UI | Known states | Mobile bottomNav | Theme issues |
|-------|-------|--------------|------------|--------------|------------------|--------------|
| `/system` | AdminModuleShell | Sidebar **System** | Tab-UI (Übersicht/Homelab/Diagnose/Cloudflare), `StatusCard` | Tab empty sections | Ja | Tabs horizontal scroll |
| `/system?tab=homelab` | AdminModuleShell | — | Homelab-Panel | — | Ja | — |
| `/system?tab=diagnose` | AdminModuleShell | — | Diagnose-Karten | — | Ja | — |
| `/system?tab=cloudflare` | AdminModuleShell | — | Tunnel/Access-Karten | — | Ja | — |
| `/admin/status` | AdminModuleShell | Sidebar + **`SystemHubBanner`** | Legacy Status-Dashboard, `HealthBadge` | — | Ja | Banner → System-Hub |
| `/jobs` | AdminModuleShell | Sidebar System | Job-Queue-Liste | Empty | Ja | — |
| `/backup` | AdminModuleShell | Sidebar System | `BackupWorkspace`, Tabellen | Empty | Ja | `.uwe-table-wrap` |
| `/settings` | **StudioAppShell** (direct) | Settings-Sidebar (`SettingsPageSidebar`) | Tabs: General, Theme (`ThemePicker`), Worlds, Portal, … | Tab-basiert | Ja (default Mehr) | Theme-Picker OK; inline `style={{marginTop}}` P2 |
| `/settings?tab=status` | StudioAppShell | — | Link zum System-Hub | — | Ja | — |

---

## Studio — Admin

| Route | Shell | Nav elements | Primary UI | Known states | Mobile bottomNav | Theme issues |
|-------|-------|--------------|------------|--------------|------------------|--------------|
| `/admin` | **StudioAppShell** `variant` admin | Admin-Übersicht Nav | Admin-Karten-Grid | — | Ja | — |
| `/admin/users` | AdminModuleShell | Sidebar **Admin** | User-Liste (Platzhalter) | — | Ja | Feature maturity low |
| `/admin/security` | AdminModuleShell | Admin | Security Dashboard | — | Ja | — |
| `/admin/audit-log` | AdminModuleShell | Admin | Audit-Tabelle | Empty | Ja | — |
| `/admin/tags` | AdminModuleShell | Admin | Tags-Admin | — | Ja | — |
| `/admin/cookbook` | AdminModuleShell | Admin | Cookbook-Sections | — | Ja | — |

---

## Studio — Legacy / weiterhin erreichbar

| Route | Shell | Nav elements | Primary UI | Known states | Mobile bottomNav | Theme issues |
|-------|-------|--------------|------------|--------------|------------------|--------------|
| `/setup` | `LoginForm`-ähnlich / `studio-auth-*` | — | Setup-Wizard | First-run | Nein | Auth-Shell |
| `/admin/ai-gateway` | AdminModuleShell | Admin | Gateway-Config | — | Ja | — |
| `/admin/api-tokens` | AdminModuleShell | Admin | Token-Liste | — | Ja | — |
| `/admin/webhooks` | AdminModuleShell | Admin | Webhook-Config | — | Ja | — |
| `/admin/mail` | AdminModuleShell | Admin | Mail Portal Admin | — | Ja | — |
| `/account/password` | `AuthPageLayout` + `AuthCard` | — | `ChangePasswordForm` | Force-change flow | Nein | Studio auth tokens |
| `/account/security` | AuthPageLayout | — | 2FA-Setup | — | Nein | — |
| `/login`, `/forgot-password`, `/reset-password` | `LoginForm` / auth pages | — | Forms | Error states | Nein | — |
| `/` (Studio root) | `UweLandingPage` | Cross-app Links | Marketing Hero | — | Nein | Landing shell |

---

## Portal (Spieler)

| Route | Shell | Nav elements | Primary UI | Known states | Mobile bottomNav | Theme issues |
|-------|-------|--------------|------------|--------------|------------------|--------------|
| `/` | `UweLandingPage` (`uwe-landing-shell`) | App-Links Studio/Portal | Hero, Feature-Liste | — | **Nein** | Portal brand gradient |
| `/worlds` | `PortalPublicShell` → PortalShellV2 | Discover-Sidebar | `PageHeaderV2`, Welt-Grid, `EmptyState` | Empty | **Ja** — `portalDiscoverBottomNav` | — |
| `/worlds/terra` | PortalPublicShell | `PortalNavByType`, Back-Link | Wiki-Home, Nav nach Typ | — | **Ja** — Tab **Start** | — |
| `/worlds/terra/[cat]/[slug]` | PortalPublicShell | Grouped Wiki Nav | `PageHeaderV2`, `WikiContent`, Tags (`.uwe-tag`) | 404 → notFound | **Ja** — `portalWorldBottomNav(…,"home")` | Reader tokens in `wiki.css` |
| `/worlds/terra/graph` | PortalPublicShell | — | `GraphView` full | Empty graph | **Ja** — Tab **Graph** | Graph tokens |
| `/login` | `LoginForm` `variant="portal"` | — | Auth-Form | — | Nein | Portal violet auth |
| `/auth/worlds` | `PortalAppShell` (hub layout) | Global Auth Nav | Welt-Liste | Empty | **Ja** — `portalAuthBottomNav` | — |
| `/auth/worlds/terra` | PortalAppShell (world layout) | Welt-Nav | Player-Dashboard | — | **Ja** — Tab **Start** | — |
| `/auth/worlds/terra/[slug]` | PortalAppShell layout + page content | Layout bottomNav | `WikiContent`, `VisibilityBadge`, Notes | — | **Ja** (via layout) | `.wiki-badge-*` duplicate |
| `/auth/worlds/terra/sessions`, `/assets`, `/notes`, `/soundboard` | PortalAppShell | Welt-Tabs | Domain views | Empty | **Ja** | — |
| `/auth/account/*` | PortalAppShell (account layout) | Account Nav | Password/Security forms | — | Ja | — |
| `/share/[token]/*` | `PortalGuestShell` | Minimal | Share-Gate, Wiki reader | Password gate | Optional | Security-critical |

**Hinweis:** Die frühere Lücke „Portal Wiki Reader ohne Bottom Nav“ ist **behoben** — `apps/portal/app/worlds/[worldSlug]/[category]/[slug]/page.tsx` übergibt `bottomNav={portalWorldBottomNav(...)}` an `PortalPublicShell`.

---

## Defect Backlog

| ID | Sev | Defect | Dateien | Fix owner |
|----|-----|--------|---------|-----------|
| D-01 | P0 | ~~Graph dark box / height~~ | `GraphView.tsx`, `uwe.css` | view-ws1 ✅ |
| D-02 | P0 | ~~KI offline red error~~ | `use-ai-prompt-capabilities.ts` | view-ws3 ✅ |
| D-03 | P1 | ~~`.uwe-table-sub` missing~~ | `uwe-components.css` | ui-auditor ✅ |
| D-04 | P1 | ~~`/worlds` wrong bottomNav active tab~~ | `worlds/page.tsx` | ui-auditor ✅ |
| D-05 | P1 | ~~Bottom nav label too small @430px~~ | `uwe.css` L.2799 | ui-auditor ✅ |
| D-06 | P1 | ~~Duplicate `.uwe-badge` base rule~~ | `uwe.css` L.3027 | ui-auditor ✅ |
| D-07 | P1 | Residual ~120 hex in `uwe.css` (non-token) | `packages/shared-ui/src/uwe.css` | ui-fix-theme-residuals |
| D-08 | P1 | Parchment theme block uses raw hex overrides | `uwe.css` L.4208+ | ui-fix-theme-residuals |
| D-09 | P1 | Badge systems duplicated (`.uwe-*` vs `.wiki-*`) | `StatusBadges.tsx`, `WikiComponents.tsx`, `wiki.css` | ui-fix-wiki-detail |
| D-10 | P1 | `.uwe-btn-primary { color: #fff }` not tokenized | `uwe.css` L.1213 | ui-fix-theme-residuals |
| D-11 | P2 | Portal theme not synced from Studio DB | `apps/portal/app/layout.tsx` | design-system-engineer |
| D-12 | P2 | Landing pages without bottom nav | `UweLandingPage.tsx` | frontend-engineer (optional) |
| D-13 | P2 | Sidebar drawer focus trap missing | `AppShell.tsx` | accessibility-engineer |
| D-14 | P2 | Filter sheet focus trap missing | `MobileComponents.tsx` | accessibility-engineer |
| D-15 | P2 | Settings page inline margin styles | `settings/page.tsx` | frontend-engineer |
| D-16 | P2 | `/worlds/.../pages/new` server action broken | `actions.ts` (missing `"use server"`) | backend-architect |
| D-17 | P2 | Admin stub pages (users, tags) low maturity | `admin/users/page.tsx` etc. | feature-orchestrator |
| D-18 | P2 | Dead `.wiki-layout` CSS | both `wiki.css` | ui-fix-wiki-detail |

---

## WP 1.1 Quick fixes — attempted vs deferred

### Implemented (this PR)

1. **`.uwe-table-sub`** — styled in `packages/shared-ui/src/uwe-components.css` (muted secondary table text).
2. **Duplicate `.uwe-badge`** — removed overriding block in `uwe.css`; semantic variants retained.
3. **Bottom nav label** — min font-size 0.65 rem @ ≤430 px (was 0.58 rem).
4. **Filter sheet badge + label editor resize handle** — `#fff` / `#3b82f6` → `--uwe-*` / `color-mix`.
5. **`/worlds` bottomNav** — `bottomNav="search"` so „Welten“ tab highlights on mobile.

### Deferred (follow-up WPs)

| Candidate | Reason deferred |
|-----------|-----------------|
| Full `uwe.css` hex migration (~120 values) | Scope → WP 1.4 (`ui-fix-theme-residuals-adcf`) |
| Badge unification (`.wiki-badge-*`) | Medium risk, GM-only semantics → WP 1.5 |
| Portal landing bottom nav | Product decision — landing uses auth shell intentionally |
| Portal theme sync | Phase 2 design-system migration |
| Inline colors in `/settings` | Low severity P2; margin-only inline styles |

---

## Verification commands

```bash
# Shell / bottomNav usage
rg "WorldModuleShell|AdminModuleShell|PortalPublicShell" apps/studio apps/portal --glob "*.tsx"
rg "bottomNav" apps/studio/src/lib/mobile-nav.ts apps/portal/src/lib/mobile-nav.ts

# Ghost classes
rg "uwe-table-sub" packages/shared-ui apps --glob "*.{css,tsx}"

# Residual hardcodes
rg '#[0-9a-fA-F]{3,6}' packages/shared-ui/src/uwe.css | wc -l
```

---

*Erstellt von Subagent ui-auditor (Phase 1, WP 1.1). Nächste WPs: 1.2 Ghost-States, 1.3 Mobile-Nav-Lücken, 1.4 Theme-Residuals, 1.5 Wiki-Detail.*
