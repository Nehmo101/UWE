# UWE — Testumgebung & Funktionsreview (2026-07-03)

Vollständiger Aufbau einer lokalen Testumgebung, Live-Smoke-Tests aller Kernbereiche
(Studio, Portal, RTX-Connector) plus statische Analyse zu Funktionstüchtigkeit,
Duplizierung, Navigation und Bugs. Erstellt auf Branch
`claude/uwe-test-environment-review-6ip1tf`.

## 1. Testumgebung — Aufbau & Ergebnis

| Schritt | Befehl | Ergebnis |
|---------|--------|----------|
| Dependencies | `pnpm install --frozen-lockfile` | OK (2m03s) |
| Prisma Client | `db:generate` | OK |
| DB-Migrationen | `db:deploy` | 76 Migrationen, 0 pending |
| Seed | `db:seed` | Welt „Terra", DM + 4 Player |
| Unit/Integration | `turbo run test` | **33/33 Tasks grün** (`@uwe/database`: 847 pass / 0 fail) |
| RTX-Connector | `pnpm --filter @uwe/rtx-connector test` | **81 pass / 0 fail** |

**Health-Endpoint** (`/api/health`): `status: ok`, DB gesund (1 Welt, 8 Seiten),
76 Migrationen angewandt, 0 pending/failed.

### Live-Smoke-Tests Studio (Port 3000, eingeloggt als `dm@uwe.local`)

Alle geprüften Seiten → **HTTP 200**:
`/`, `/studio`, `/worlds`, `/life-brain`, `/life-brain/chat`, `/ai`, `/finance`,
`/kitchen`, `/kitchen/recipes`, `/mail`, `/calendar`, `/projects`, `/image-studio`,
`/search`, `/jobs`, `/bugs`, `/account/security`, `/account/password`,
`/admin/users`, `/admin/cockpit`, `/admin/status`, `/admin/agent-jobs`,
`/admin/cookbook`, `/system`.

- Login-Flow (`POST /api/auth/login`) funktioniert, Rate-Limit + Audit-Logging aktiv.
- `/api/admin/users` ohne Session → **401**; als Nicht-Admin (DM) → **403**
  (Rollen-Gate greift korrekt).

### Live-Smoke-Tests Portal (Port 3001)

Health 200; `/`, `/login`, `/portal`, `/worlds` → 200; Player-Login
(`aman@uwe.local`) funktioniert.

### RTX-Connector — End-to-End verifiziert

- `client-cli probe-runners` → erkennt Ollama/LM Studio/llama.cpp korrekt als offline.
- `client-cli cookbook-dashboard` → echte Hardware-Erkennung (CPU-Backend,
  Kerne/RAM) + Modell-Fit-Scoring.
- **Voller Handshake gegen den Host:** Token in Studio erstellt
  (`POST /api/admin/connectors`), Connector gestartet → Status wechselte
  `offline → online`, meldete Version 1.0.0, Capabilities und Heartbeat
  (`lastHeartbeatAt` aktualisiert). Der outbound Poll-/Heartbeat-Flow inkl.
  Token-Auth funktioniert.

**Fazit Funktionstüchtigkeit:** Kern ist stabil und testgedeckt. Keine
funktionalen Blocker gefunden.

## 2. Bugs & Reliability

Der Code ist ungewöhnlich sauber: keine `TODO/FIXME/HACK`, keine `@ts-ignore`,
genau ein `as any` (nur in einer Testdatei), ein einziger (bewusster) leerer
`catch` im Theme-Bootstrap. Die realen Fundstellen konzentrieren sich auf **eine**
Datei im RTX-Download-Pfad:

| Prio | Fundstelle | Problem |
|------|-----------|---------|
| **Mittel** | `tools/uwe-rtx-connector/src/huggingface-download.ts:110` | `createWriteStream` ohne `writer.on("error")`. Ein async Write-Fehler (Platte voll, I/O) außerhalb des `once(writer,"drain")`-Awaits wird nicht vom `try/catch` (nur Read-Loop) gefangen → unhandled `'error'` kann den ganzen Connector-Prozess samt aktiver Jobs killen. |
| **Mittel** | `huggingface-download.ts:170` | Download-`fetch` **ohne** `signal`/Timeout — anders als jeder andere Host-/Ollama-Request (die konsequent `AbortSignal.timeout` nutzen). Halb-offener TCP-Stream → Download hängt unbegrenzt. Voll-Timeout wäre bei großen Modellen falsch, aber ein Idle-/Progress-Timeout fehlt komplett. |
| **Niedrig** | `huggingface-download.ts:143-146` | `writer.end(); await once(writer,"finish"); renameSync(...)` steht außerhalb von `try/finally`. Fehler beim Finalisieren → verwaiste `.part`-Temp-Datei (Cleanup nur im Read-Loop-`catch`). |

Empfehlung: alle drei zusammen in `writeResponseBody`/`downloadHuggingFaceModel`
beheben (Error-Listener + Idle-Timeout via `AbortController` + Cleanup in `finally`).

### Security — geprüft, solide

- **`requireStudioApiAuth`** ist bewusst nur CSRF-/Token-Guard; die
  **Session-Pflicht** setzt die Middleware durch (`config.authRequired`, default
  = `isProduction`). In Dev ohne `AUTH_SECRET` sind GET-Studio-APIs daher offen —
  **Dev-Artefakt, kein Prod-Leck.** In Produktion greift die Session-Gate-Middleware.
- **`dm_only`-Leak ins Portal:** mehrschichtig abgesichert (`canReadContent`,
  `filterBlocksForViewer`, `PORTAL_PAGE_VISIBILITIES`-Filter) + dedizierte Tests
  (`visibility-leak`, `visibility-security`, `public-leak-scanner`). Kein Leck.
- **XSS über `dangerouslySetInnerHTML`:** entschärft — `renderContentHtml`
  escaped jeden Abschnitt, nur kontrollierte `<a>`/`<span>` werden emittiert.
- RTX-Token-Handling/Reconnect: Bearer + SHA-256-Hash im Host, 401/403 → sauberes
  Beenden, transiente Fehler → Retry, Graceful-Drain beim Shutdown. Robust.

## 3. Überflüssiges / Duplizierung

| Prio | Fundstelle | Empfehlung |
|------|-----------|-----------|
| **Hoch** | `apps/studio/src/lib/studio-navigation.ts` + `global-nav.ts` | Totes 5-Sektionen-Parallel-IA (`TARGET_STUDIO_NAV`, `studioSidebarSections`, `globalNavItems`) ohne externe Aufrufer. **Kritisch:** die aktive Command-Palette (`studioCommandPaletteCommands:518`) iteriert über das **veraltete** `TARGET_STUDIO_NAV` → Cmd+K zeigt ein anderes Menü als die Sidebar (aktives `src/navigation/studio-nav.ts`). Palette auf `STUDIO_NAV` umstellen, Toten Code löschen. |
| **Hoch** | `apps/studio/.../shell/AppShell.tsx` ↔ `apps/portal/.../shell/AppShell.tsx` | Nahezu identisch (Sidebar+Topbar+Palette+MobileNav) → gemeinsame `AppShell` nach `packages/shared-ui`. |
| **Hoch** | `apps/portal/src/components/ui/*` | Paralleles UI-Kit (button, card, dialog, input, select, tabs, command-palette …) dupliziert `packages/shared-ui/src/components/*`. Studio nutzt shared-ui, Portal ein Eigen-Kit → konsolidieren. |
| **Mittel** | `packages/shared-ui/src/AppShell.tsx`, `NavSidebarSections`, `CollapsibleNavSidebar`, `PortalNav` | Von keiner App mehr importiert (nur Tests). Datei splitten (genutzte Exports `SidebarSection`/`StatGrid`/`PageHeader`/`EmptyState`/`Breadcrumb` erhalten), Shell-Teil entfernen. |
| **Mittel** | `ChangePasswordForm`, `CreateWorldForm`, `LogoutButton`, Forgot/Reset-Forms | Je einmal in Studio und Portal (fast identisch) → nach `packages/shared-ui/src/auth`. |
| **Niedrig** | `label-service.ts:579,616`, `ai-brain/save-results.ts:48`, `ai-review-service.ts:644`, `studio-navigation.ts:521` | Inline-Slugs (`.toLowerCase().replace(...)`) umgehen `@uwe/shared-utils` und behandeln Umlaute falsch → auf `slugifyDe`/`slugifyAscii` umstellen. |

## 4. Navigation — Verbesserungen

Positiv: zentrale Nav-Quelle (`src/navigation/studio-nav.ts` → `StudioShell`),
eingebauter Health-Check (`inspect-navigation.ts`) + Tests, **keine toten Links**.

- ✅ **Command-Palette vs. Sidebar divergieren** (siehe Duplizierung Hoch #1) — die
  wichtigste Navigations-Inkonsistenz. *(erledigt)*
- ✅ **Sektion „Werkzeuge" überladen** (13 Einträge). In drei Sidebar-Untergruppen
  aufgeteilt — „Erfassen & Alltag", „Inhalte & Medien", „Automatisierung" — nach
  dem Muster von `Organisation`/`System` (mehrere NavGroups, `section` bleibt
  „Werkzeuge", 7-Sektionen-IA + Nav-Tests unverändert). *(erledigt)*
- **Route-Prefix ↔ Nav-Gruppe passen nicht:** `Reviews`, `Agent Jobs`,
  `AI Gateway`, `Prompt-Konsole` liegen unter `/admin/*`, erscheinen aber in
  „Werkzeuge"/„AI". *(rein informativ — Routen-Refactor, nicht dringend)*
- **Benennungsdopplung:** „Prompt-Konsole" (`/admin/ai-prompt`) vs.
  „Prompt-Bibliothek" (`/prompts`) — schwer unterscheidbar. *(offen, gering)*
- **Korrektur — „verwaiste Seiten":** `admin/secrets`, `admin/status`, `admin/mail`
  sind **nicht** verwaist, sondern alle über die `/admin`-Hub-Seite (und teils
  `/settings`, `/admin/setup`) erreichbar. Ein zusätzlicher Sidebar-Eintrag wäre
  redundanter Clutter → **kein Handlungsbedarf**. (`/account` ohne Index-Seite →
  404; bewusst, nur `/account/security` + `/account/password` existieren — ggf.
  Redirect ergänzen.)

Portal-Navigation (`portal-nav.ts`): konsistent, keine toten Links, keine
Auffälligkeiten.

## 5. Nachtrag: „UI-Duplizierung" ist eine laufende Design-System-Migration

Die in Abschnitt 3 als „Duplizierung Hoch" gelistete Portal-UI-Kit ↔ shared-ui
ist **kein versehentliches Duplikat**, sondern zwei koexistierende Design-Systeme
im Rahmen eines geplanten „Hard UI/UX Reset" (verbindlich in
[docs/design/new-ui-stack.md](../design/new-ui-stack.md)):

- **Ziel-System:** Tailwind v4 + shadcn-artige Primitives + CVA, pro App unter
  `src/components/ui/*` (Copy-in, Regel 3). Portal ist bereits dort; Studio hat
  sein `src/components/ui/*` ebenfalls schon, viele Seiten sind migriert.
- **Legacy-System:** `uwe-btn`/`uwe-badge`-CSS-Klassen aus
  `packages/shared-ui/src/uwe-components.css`, genutzt von den verbliebenen
  Studio-Bestandskomponenten. Wird **seitenweise** retired (Regel 7), nie brechen.
- Ein Token-Bridge (`@theme` in `globals.css`) mappt `--color-*` auf die
  bestehenden `--uwe-*`-Theme-Variablen — beide Systeme rendern dieselbe Palette.

Die per-App-Kits sind also **gewollt** (shadcn-Pattern), nicht zu „entdoppeln".
Der offene Rest ist die Migration der letzten Legacy-Consumer in Studio.

### Verbleibende Legacy-`@uwe/shared-ui`-UI-Consumer in Studio
- `apps/studio/src/components/system/ReleaseNotes.tsx` — `Badge` (braucht
  lokales `badge.tsx` + semantische Tokens info/success/warning, die im
  Token-Bridge noch fehlen → Design-Entscheidung).
- `apps/studio/components/mail/MailCenterTabs.tsx` — `Tabs` (API-Umbau auf das
  Radix-Compound-`Tabs` des lokalen Kits).
- `apps/studio/components/ImageStudioWorkspace.tsx` — `Card` (mit `title`-Prop)
  und `ToolWindow` (kein direktes Äquivalent; Kandidat `Sheet`/`Dialog`).
- ImageStudio-**Buttons** sind bereits migriert (Commit in diesem Branch).

## 6. Empfohlene Reihenfolge

1. ✅ **Command-Palette auf aktives `STUDIO_NAV` umstellen** + toten Nav-Code
   gelöscht (`studio-navigation.ts`, `global-nav.ts`). *(erledigt)*
2. ✅ **RTX-Download härten** (`huggingface-download.ts`: Error-Listener,
   Idle-Timeout, Cleanup in `finally`) + Tests. *(erledigt)*
3. **Design-System-Migration Studio → Tailwind** fortsetzen (per-Fläche, Legacy-
   CSS zuletzt): ImageStudio-Buttons ✅; offen: Badge/Tabs/Card/ToolWindow (s.o.).
4. **Nav-Feinschliff** („Werkzeuge" splitten, Benennung, verwaiste Seiten).
5. Inline-Slugs auf `@uwe/shared-utils` umstellen.
