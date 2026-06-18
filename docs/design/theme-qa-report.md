# Theme / UI Migration — QA Regression Report

**Datum:** 2026-06-18  
**Basis:** `main` nach Orchestrierung Schritte 1–8 (#123–#126, #107)  
**Agent:** UWE QA Regression Agent  
**Umgebung:** Linux, Node 22, pnpm 10.12.1

---

## Zusammenfassung

Die **UWE Theme-Pipeline (Schritte 1–8)** ist auf `main` integriert. Token-System, Theme Picker, Visual Polish und A11y-Verbesserungen sind implementiert. `pnpm quality` ist grün.

| Bereich | Status |
|---------|--------|
| Build / `pnpm quality` | ✅ Pass |
| Theme Architecture (`packages/shared-ui/src/theme/`) | ✅ Merged (#107) |
| Theme Picker (client + server) | ✅ `ThemeSettingsPanel` + `ThemePicker` |
| Theme Persistenz (localStorage) | ✅ `ThemeBootstrapScript` + `ThemeProvider` |
| Component Token Migration | ✅ ~50% weniger `rgba()` in `uwe.css` (#124) |
| Visual Polish (patterns, glass, scrollbars) | ✅ `uwe-visual-polish.css` (#125) |
| Mobile / A11y | ✅ Touch targets, focus rings, checklist (#126) |
| Command Palette (Dev + CSP) | ⚠️ Dev-Modus weiterhin CSP-Einschränkungen |

---

## Getestete Befehle

| Befehl | Ergebnis |
|--------|----------|
| `pnpm install --frozen-lockfile` | ✅ Pass |
| `pnpm quality` (vollständiges CI-Gate) | ✅ Pass |
| `pnpm lint` | ✅ Pass |
| `pnpm typecheck` | ✅ Pass |
| `pnpm test` | ✅ Pass |
| `pnpm test:security` | ✅ Pass |
| `pnpm build:release` | ✅ Pass |

---

## Smoke-Test-Ergebnisse

### 1. Studio

| Check | Ergebnis | Details |
|-------|----------|---------|
| Theme-Modul vorhanden | ✅ | `tokens.ts`, `themes.ts`, `ThemeProvider`, `ThemeBootstrapScript` |
| Settings → Erscheinungsbild | ✅ | `/settings?tab=appearance` — `ThemeSettingsPanel` |
| Server-Standards + Preview | ✅ | `VisualThemePreview`, `data-uwe-*` HTML-Attribute |
| Accessible Theme Picker | ✅ | `ThemePicker` fieldset, radio swatches, SR labels |
| Theme Persistenz | ✅ | `localStorage` pro Scope (`studio` / `portal`) |
| 9 Presets | ✅ | `uwe-default`, `uwe-portal-purple`, `terra`, `hells`, … |

### 2. Portal

| Check | Ergebnis | Details |
|-------|----------|---------|
| ThemeProvider | ✅ | `scope="portal"`, Default `uwe-portal-purple` |
| Shared CSS + Visual Polish | ✅ | `uwe.css` + `uwe-visual-polish.css` |
| Unabhängige Theme-Wahl | ✅ | Separater localStorage-Key |

### 3. Mobile / A11y

| Check | Ergebnis | Details |
|-------|----------|---------|
| Touch targets ≥44px | ✅ | `--uwe-touch-min: 2.75rem` |
| Focus-visible rings | ✅ | `--uwe-focus-ring`, form `:focus-visible` |
| Skip link / SR-only | ✅ | `.uwe-skip-link`, `.uwe-sr-only` |
| `prefers-reduced-motion` | ✅ | In `uwe-visual-polish.css` |
| A11y Checklist | ✅ | `docs/design/theme-a11y-checklist.md` |

### 4. Regression

| Check | Ergebnis | Details |
|-------|----------|---------|
| Keine kaputten Imports | ✅ | Lint + Typecheck + Build grün |
| AGPL-sauber | ✅ | Keine `odysseus-*` Theme-IDs, keine Code-Copy |
| Legacy Theme-ID Migration | ✅ | `LEGACY_THEME_ID_MAP` in `storage.ts` |

---

## Bekannte Einschränkungen

### LIM-1: Dual Theme Sources

- **Client:** `UweThemePreferences` in localStorage (9 Presets, Font, Density, …)
- **Server:** `settings.app.theme` + `backgroundPattern` + `frostedGlass` + `motionEnabled`
- **Status:** Koexistieren; vollständiger DB↔Client-Sync noch offen (siehe `theme-migration-notes.md`)

### LIM-2: Verbleibende hardcodierte Farben

- ~73 `rgba()` in `uwe.css` (vor Migration: 148)
- Auth-Seiten in `globals.css` bewusst brand-spezifisch

### LIM-3: Command Palette in Dev + CSP

- Strikte CSP blockiert `unsafe-eval` im Next.js Dev-Modus
- **Workaround:** Production-Build testen

---

## Behobene Lücken (gegenüber Vorbericht)

| Vorher (Pre-#107) | Jetzt |
|-------------------|-------|
| Kein Theme Picker | ✅ `ThemeSettingsPanel` + `ThemePicker` |
| Kein Runtime-Theming | ✅ CSS-Variablen + `applyThemePreferences` |
| Keine Persistenz | ✅ `ThemeBootstrapScript` (no-flash) |
| Statisches Dark-CSS | ✅ 9 Presets + Server `data-uwe-*` |

---

## Empfohlene Follow-ups

1. **DB↔Client Sync** — `UweThemePreferences` optional in Settings speichern
2. **Token Sweep Phase 2** — verbleibende `rgba()` in Forms/Tables
3. **Portal Appearance Entry** — player-facing Theme-Control (optional)
4. **E2E Test** — Theme wechseln → Reload → Persistenz (Playwright)
5. **Light Theme QA** — `uwe-parchment-study` über alle Studio-Module

---

## Artefakte

- Theme-Modul: `packages/shared-ui/src/theme/`
- Visual Polish: `packages/shared-ui/src/uwe-visual-polish.css`
- Orchestrierung: `docs/design/theme-orchestration.md`
- Design Audits: `odysseus-ui-audit.md`, `uwe-current-design-audit.md`, `odysseus-license-risk.md`
