# UWE QA Automation — Checklist Runner

**Stand:** Juni 2026  
**Bezug:** [uwe-qa-urls.md](./uwe-qa-urls.md) (manuelle URL-Liste) · [design-v2-reference.md](./design-v2-reference.md) (Theme-Presets & Abnahme-Screens) · [UWE-Analyse-Features-Orchestrator_1.md](../engineering/UWE-Analyse-Features-Orchestrator_1.md) (Merge-Welle)

Dieses Dokument bündelt **automatisierte** Checks, die Teile der manuellen QA aus `uwe-qa-urls.md` abdecken, plus die **manuelle Browser-Matrix** (9 Theme-Presets) und die **Merge-Gate-Checkliste** für das Orchestrator-Programm.

---

## Schnellstart

```bash
pnpm install --frozen-lockfile
cp -n .env.example .env
pnpm --filter @uwe/database db:deploy
pnpm --filter @uwe/database db:seed   # Demo-Welt Terra, dm@uwe.local / uwe-dev

# Automatisierte QA-Smoke (IA + Security + optional A11y E2E)
node scripts/qa-smoke.mjs

# Vollständiges PR-Gate (wie CI)
pnpm quality
pnpm docs:check
```

Lokal: Studio `:3000`, Portal `:3001`. E2E nutzt Production-Builds auf `:3199`/`:3200` via `scripts/e2e-servers.mjs`.

---

## 1. Automatisierte Checks (Spiegel zu uwe-qa-urls.md)

Die folgende Tabelle mappt Abschnitte aus `uwe-qa-urls.md` auf existierende Test-Befehle. Kein Befehl simuliert Erfolg — jeder Schritt führt echte Tests aus.

| uwe-qa-urls Abschnitt | Befehl | Was geprüft wird |
|----------------------|--------|------------------|
| Sidebar IA (9 Sektionen) | `pnpm --filter @uwe/studio test` | `studio-navigation.test.ts` — Sektionen Heute…Admin, Welten/Leben/KI/System-Links, Command Palette, `/admin/ai-prompt` nicht in Sidebar |
| Mobile Bottom Nav (390 px) | ↑ (gleicher Befehl) | `mobile-nav.test.ts` — Tabs Heute/Leben/Welten/KI/Mehr, World-Bottom-Nav, `resolvePreferredWorldSlug` |
| Redirects `/studio` → `/today`, `/admin/ai-prompt` → `/ai` | ↑ + E2E optional | Unit: IA ohne Legacy-KI-Link; E2E: `e2e/studio-auth.spec.ts` (Login-Flow) |
| Portal — kein `dm_only`-Leak | `pnpm test:security` | `@uwe/security-tests`, `studio-route-auth.test.ts`, `security-leaks.test.ts`, Visibility/Permissions-Regression |
| Health & Auth (Smoke) | `pnpm test:e2e` | `e2e/studio-shell.spec.ts`, `e2e/portal-shell.spec.ts` — Shell lädt nach Login |
| Themes (9 Presets, Token-Integrität) | `pnpm --filter @uwe/shared-ui test` | `design-v2.test.ts` — alle Presets, CSS-Bundle, Parchment-Handoff-Tokens |
| A11y WCAG A/AA (Smoke) | `pnpm test:e2e:a11y` | axe-core auf Studio `/today` + Portal `/worlds/terra` (siehe Hinweis unten) |
| `/worlds/[slug]/pages/new` Server Action | ↑ Studio test | `createPageAction` in `"use server"`-Modul |

### 1.1 Studio-Navigation & Mobile Nav

```bash
pnpm --filter @uwe/studio test
```

Deckt ab:

- Konsolidierte Sidebar: **Heute · Welten · Leben · Werkstatt · Wissen · Medien · KI · System · Admin**
- Welten-Nav (16 Einträge inkl. Brain Store, KI-Läufe, Neue Seite)
- World-Cockpit-Tabs, Command-Palette-Gruppen, System-Hub aktiv bei `/admin/status`
- Mobile Global-Nav: `/today`, `/capture`, `/worlds`, `/ai`, Sidebar-Fallback

### 1.2 Security (`test:security`)

```bash
pnpm test:security
```

Entspricht uwe-qa-urls Portal-Hinweis und Orchestrator-Regeln:

| Teil | Inhalt |
|------|--------|
| `pnpm --filter @uwe/security-tests test` | Authz, Leak-Scanner, Studio-Route-Guards |
| `scripts/studio-route-auth.test.ts` | Jede Studio-API-Route geschützt oder allowlisted |
| `scripts/security-leaks.test.ts` | Visibility-Tests vorhanden, `filterBlocksForContext`, keine `AUTH_SECRET`-Leaks |

Feingranular:

```bash
pnpm test:authz    # nur Authz + Studio-Route-Inventar
pnpm test:leaks    # nur Leak-Regression
```

### 1.3 Accessibility E2E (axe-core)

```bash
pnpm test:e2e:a11y
```

Führt Playwright gegen Production-Builds aus (`playwright.config.ts` → `scripts/e2e-servers.mjs`):

| Spec | Route | Erwartung |
|------|-------|-----------|
| `e2e/studio-a11y.spec.ts` | `/today` (nach DM-Login) | Keine WCAG-A/AA-Verstöße (axe), `main` + Heading „Heute“ |
| `e2e/portal-a11y.spec.ts` | `/worlds/terra` (öffentlich) | Keine WCAG-A/AA-Verstöße, Heading „Terra“ |

**Hinweis:** Script und Specs kommen mit PR [#243](https://github.com/Nehmo101/UWE/pull/243) (`cursor/a11y-e2e-axe-adcf`). Bis zum Merge: `node scripts/qa-smoke.mjs` überspringt A11y mit Hinweis; nach Merge ist der Schritt Pflicht.

Vollständiges E2E (Auth, Shell, Visual):

```bash
pnpm test:e2e
# nur Studio: playwright test --project=studio
# nur Portal: playwright test --project=portal
```

Playwright installieren (einmalig): `pnpm exec playwright install chromium`

### 1.4 Design V2 — Theme-Presets (unit)

```bash
pnpm --filter @uwe/shared-ui exec node --import tsx --test src/design-v2/design-v2.test.ts
```

Automatisiert die 9 Presets aus `design-v2-reference.md` (Token-Auflösung, Pflicht-Farbkeys). Ersetzt **nicht** visuelle Browser-Prüfung — siehe Abschnitt 2.

### 1.5 QA-Smoke-Runner

```bash
node scripts/qa-smoke.mjs
# oder nach package.json-Eintrag:
pnpm test:qa-smoke
```

Reihenfolge: Studio IA → Design-V2-Presets → A11y E2E (wenn vorhanden) → `test:security`. Exit-Code ≠ 0 bei echtem Fehler.

---

## 2. Manuelle Browser-Matrix (9 Presets × Kern-Routen)

**Quelle Presets:** `design-v2-reference.md` — alle 9 Themes in Settings → Erscheinungsbild wählen.

| # | Preset-ID | Kurzname |
|---|-----------|----------|
| 1 | `uwe-parchment-os` | Parchment OS (Standard hell) |
| 2 | `uwe-default` | UWE Default (dunkel) |
| 3 | `uwe-dark-fantasy` | Dark Fantasy |
| 4 | `uwe-charcoal-desk` | Charcoal Desk |
| 5 | `uwe-night-observatory` | Night Observatory |
| 6 | `uwe-parchment-study` | Parchment Study |
| 7 | `uwe-phosphor-console` | Phosphor Console |
| 8 | `terra` | Terra |
| 9 | `hells` | Hells |

**Kern-Routen** (Abnahme-Screens aus `design-v2-reference.md`):

| App | Viewport | Route | Prüfpunkte |
|-----|----------|-------|------------|
| Studio | Desktop ≥1280px | `/today` | Daily Cockpit, Layout-Editor, System-Ampel, keine dunklen Fremdkörper |
| Studio | Desktop | `/worlds/terra/lore/amans-geheimnis` | Wiki-Detail, Graph kompakt (≤220px), Badges lesbar |
| Studio | Desktop | `/settings?tab=appearance` | Theme-Picker, Zonen-Overrides, Fokus-Ringe |
| Studio | Mobile 390px | `/today` | Bottom-Nav (5 Tabs), Touch-Targets ≥44px |
| Studio | Mobile 390px | `/ai` | Ruhiger Offline-Hinweis statt harter Fehlerbox |
| Portal | Desktop | `/worlds/terra` | Öffentliche Welt, konsistente Badges, kein DM-Chrome |
| Portal | Desktop | `/login` | Auth-Flow, Kontrast Labels/Inputs |
| Portal | Desktop | `/auth/worlds/terra` | Spieler-Dashboard (nach Player-Login) |

### Matrix-Vorlage (54 Zellen)

Für jedes Preset **P1…P9** jede Kern-Route **R1…R6** abhaken:

| Preset | R1 `/today` D | R2 Wiki D | R3 Settings D | R4 `/today` M | R5 `/ai` M | R6 Portal×3 |
|--------|---------------|-----------|---------------|---------------|------------|-------------|
| P1 parchment-os | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ ☐ ☐ |
| P2 uwe-default | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ ☐ ☐ |
| … P3–P9 | | | | | | |

**Mindest-Abnahme** (wenn 54 Zellen zu aufwendig): **P1 + P2** auf allen 6 Routen (= 12 Checks) plus Stichprobe P8 `terra` auf Wiki + Portal.

Zusätzlich aus `uwe-qa-urls.md` (einmal pro Release-Welle, preset-unabhängig):

- [ ] `/studio` → `/today`
- [ ] `/admin/ai-prompt?world=terra&page=example` → `/ai?…`
- [ ] `/system?tab=homelab|diagnose|cloudflare` — Tabs wechseln
- [ ] Banner auf `/hardware` und `/admin/status`
- [ ] Sidebar komplett auf Deutsch (Abschnitt „Abnahme“ in uwe-qa-urls.md)

Referenz-Screenshots: `docs/design/scraps/today-desktop.png`, `today-mobile.png`

---

## 3. Merge-Gate-Checkliste (Orchestrator-Programm)

Für PRs der Welle `cursor/*-adcf` und Final-QA nach [UWE-Analyse-Features-Orchestrator_1.md](../engineering/UWE-Analyse-Features-Orchestrator_1.md).

### 3.1 Vor jedem Subagent-PR

- [ ] Branch von aktuellem `main`, Prefix `cursor/<name>-adcf`
- [ ] Scope = ein Arbeitspaket, keine Konflikt-Dateien parallel (siehe Orchestrator-Doc)
- [ ] `pnpm install --frozen-lockfile`
- [ ] **`pnpm quality`** — Exit 0 (lint, secret scan, typecheck, test, test:security, audit, build, bundle budget)
- [ ] `pnpm docs:check` — wenn Markdown geändert
- [ ] Keine Secrets, keine CSP-/Auth-Schwächung ohne Review
- [ ] Kurze PR-Beschreibung: Dateien, Entscheidungen, Risiken

### 3.2 Vor Merge der UI/A11y-Welle (#236–#246)

Empfohlene Reihenfolge (Orchestrator): **#236 → #237 → #238 → #239 → #240 → #241 → #244 → #245 → #246 → #243 → #242**

Nach Merge der Phase-1–6-PRs:

- [ ] `node scripts/qa-smoke.mjs` — inkl. `test:e2e:a11y` (nach #243)
- [ ] `pnpm test:e2e` — Studio + Portal Shell/Auth grün
- [ ] Manuelle Matrix **P1 + P2** (mind. 12 Browser-Checks)
- [ ] Stichprobe `uwe-qa-urls.md` Sidebar-Routen (Heute, Welten/terra, System-Tabs, Portal)

### 3.3 Nicht verhandelbare Regeln (automatisch + Review)

| Regel | Enforcement |
|-------|-------------|
| Portal filtert `dm_only` serverseitig | `pnpm test:security`, `permissions.ts` |
| Cloud-KI ohne Brain/Welt/Life-Kontext | `privacyGuard.ts` |
| KI-Output = Proposal/Draft | AI Runs / Generator |
| RTX nur LAN | `docs/security/DEPLOYMENT_SECURITY.md`, System-Hub |
| Daily Admin nur Studio | Routen + Security-Tests |

### 3.4 Final QA (qa-engineer) — Abnahme Orchestrator-Welle

Wenn alle Draft-PRs gemergt:

1. **Automatisiert:** `pnpm quality` + `node scripts/qa-smoke.mjs` + `pnpm test:e2e`
2. **Manuell:** Vollständige oder Mindest-Matrix (Abschnitt 2) + `uwe-qa-urls.md` Abnahme-Checkboxen
3. **Produktion optional:** Health-URLs aus uwe-qa-urls (Smoke), Cloudflare-Tab im System-Hub
4. **Ergebnis dokumentieren:** bestanden / fehlgeschlagen / Blocker / Kleinigkeiten / empfohlene Fixes (siehe Subagent-Vorlage unten)

---

## 4. Subagent-Vorlage: qa-engineer

```text
Du bist qa-engineer für UWE.

Branch: cursor/qa-checklist-runner-adcf (oder Follow-up von main).

1. Lies docs/design/uwe-qa-automation.md (dieses Dokument).
2. Lies docs/design/uwe-qa-urls.md und docs/design/design-v2-reference.md.
3. Führe aus:
   pnpm install --frozen-lockfile
   node scripts/qa-smoke.mjs
   pnpm quality
   pnpm docs:check
   pnpm test:e2e          # wenn Playwright installiert
4. Manuelle Matrix: mindestens Presets uwe-parchment-os + uwe-default auf Kern-Routen.
5. Ergebnisformat:
   - bestanden
   - fehlgeschlagen (Blocker)
   - kleinere Probleme
   - empfohlene Fixes

Zusätzlich KI/Security-Szenarien (bei KI-PRs): Cloud+Brain blockiert, RTX offline,
keine Brain-Daten an Cloud — siehe docs/ai-orchestrator-subagents-prompts.md § qa-engineer.
```

---

## 5. Referenzen

| Dokument | Inhalt |
|----------|--------|
| [uwe-qa-urls.md](./uwe-qa-urls.md) | Vollständige URL-Checkliste (106+ Studio, Portal, Mobile) |
| [design-v2-reference.md](./design-v2-reference.md) | Presets, Abnahme-Screens, Token-Mapping |
| [theme-a11y-checklist.md](./theme-a11y-checklist.md) | Kontrast, Touch, Fokus (manuell) |
| [UWE-Analyse-Features-Orchestrator_1.md](../engineering/UWE-Analyse-Features-Orchestrator_1.md) | PR-Welle, Merge-Reihenfolge |
| [product-orchestrator-plan.md](../engineering/product-orchestrator-plan.md) | Langfristige Subagent-Pakete |
| [AGENTS.md](../../AGENTS.md) | `pnpm quality` Gate |
