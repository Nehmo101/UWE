# Theme-System Orchestrierung (Subagent-Reihenfolge)

Dieses Dokument definiert die **verbindliche Ausführungsreihenfolge** für Cloud-Agents und Subagents beim UWE-Theme-System. Odysseus dient nur als **UX-Referenz** (AGPL-3.0) — kein Code-Copy, keine Odysseus-Lizenz im Produkt-UI.

## UI-System Fortsetzung (nach Theme-Orchestrierung)

Shells, ToolWindows und Shared-UI-Primitives folgen einem separaten Phasenplan:

- **Phase 1:** [odysseus-ui-architecture-analysis.md](./odysseus-ui-architecture-analysis.md) — Analyse + UWE-Konzept
- **Phase 2–5:** Theme-Token-Erweiterung, `StudioShell`/`PortalShell`/`AdminShell`, Seiten-Migration, `ToolWindow`

Theme-Orchestrierung (#107–#128) bleibt abgeschlossen; die UI-Shell-Pipeline baut darauf auf.

## View-Polish (#226–#229) — Ansichten-Track

Eigenständiger, view-only Track (kein Funktions-/Backend-/Security-Umbau) auf Basis von
[uwe-ansichten-analyse-und-plan.md](./uwe-ansichten-analyse-und-plan.md). Behebt die unter
**Parchment OS** (realer Universal-Default) sichtbaren Theme-Bypass-Defekte und entrümpelt die
Detailseite. Fünf Workstreams, je eigener Branch + PR, gemäß Abhängigkeitsgraph §4 des Plans.

| WS | PR | Branch | Inhalt | Status |
|----|----|--------|--------|--------|
| WS-2 | #227 | `claude/view-ws2-theme-css` | Theme-brechende CSS-Farben → `--uwe-*`-Tokens; Token-Treue-Policy-Kommentar | offen |
| WS-3 | #226 | `claude/view-ws3-quiet-states` | KI-Panel: ruhiger „nicht verfügbar"-Hinweis statt rotem Fehler; Empty/Loading-States | offen |
| WS-1 | #228 | `claude/view-ws1-graph-fix` | Graph theme-treu + höhenbegrenzt (preserveAspectRatio, 220px-Cap); Wiki-Seite: `GraphRelationList` + Link | offen |
| WS-4 | #229 | `claude/view-ws4-readability` | Lesebreite (`.wiki-reader`), Verwaltungs-Panels (Freigabe/KI) in `Collapsible`; stacked auf WS-1 | offen |
| WS-5 | — | `claude/view-ws5-consistency` | A11y (Bottom-Nav-Label 0.7rem), toter `.wiki-layout`-CSS entfernt, Doku auf Parchment-OS-Realität | offen |

Abhängigkeiten: WS-2 (Token-Contract) → WS-1/WS-4; WS-3 unabhängig; WS-4 nach 1–3 (stacked auf WS-1); WS-5 zuletzt.
Invarianten je PR: keine neuen hartcodierten Hex/RGBA in `apps/*/app/**` & `packages/shared-ui/src/*.css`,
GM-only-Badges bleiben rot, Wiki-Sanitizing/Share-Gate/Palette-Keyboard/Label-Print unangetastet,
`pnpm install --frozen-lockfile && pnpm quality` als Gate.

## Status auf `main` (Stand: nach Orchestrierung #123–#127)

| Schritt | Agent | Artefakt | Status |
|---------|-------|----------|--------|
| 1 | Odysseus UI Audit | `docs/design/odysseus-ui-audit.md` | ✅ merged (#107) |
| 2 | UWE Design Audit | `docs/design/uwe-current-design-audit.md` | ✅ merged (#123) |
| 3 | License Agent | `docs/design/odysseus-license-risk.md` | ✅ merged (#107) |
| 4 | Theme Architecture | `packages/shared-ui/src/theme/*` | ✅ merged (#107) |
| 5 | Theme Picker | `ThemeSettingsPanel`, Settings-Tab | ✅ merged (#107) |
| 6 | Component Migration | Token-Migration in CSS/Komponenten | ✅ merged (#124) |
| 7 | Visual Polish | Patterns, Glass, Scrollbars, Preview | ✅ merged (#125) |
| 8 | Mobile & A11y | `ThemePicker`, Touch-Targets, Checklist | ✅ merged (#126) |
| 9 | QA Regression | `docs/design/theme-qa-report.md` | ✅ merged (#127) |
| 10 | Documentation | Finale Docs + diese Orchestrierung | ✅ merged (#128) |

## Ausführungsgraph

```mermaid
flowchart TD
  subgraph parallel [Parallel — Schritt 1–3]
    A1[1 Odysseus UI Audit]
    A2[2 UWE Design Audit]
    A3[3 License Agent]
  end
  A4[4 Theme Architecture]
  A5[5 Theme Picker]
  A6[6 Component Migration]
  A7[7 Visual Polish]
  A8[8 Mobile & A11y]
  A9[9 QA Regression]
  A10[10 Documentation final]

  A1 --> A4
  A2 --> A4
  A3 --> A4
  A4 --> A5
  A4 --> A6
  A5 --> A7
  A6 --> A7
  A5 --> A8
  A6 --> A8
  A7 --> A8
  A8 --> A9
  A9 --> A10
  A4 -.->|parallel ab 4| A10
```

## Subagent-Anweisungen

### Schritt 1 — Odysseus UI Audit (parallel)

**Ziel:** Konzepte dokumentieren (Farben, Dichte, Patterns, Theme-Picker-UX), **ohne** Code oder Assets zu kopieren.

**Output:** `docs/design/odysseus-ui-audit.md`

**Branch-Vorlage:** `cursor/odysseus-ui-audit-9484`

**Gate:** Nur Docs, kein Code. AGPL-sauber.

---

### Schritt 2 — UWE Design Audit (parallel)

**Ziel:** Ist-Zustand von Studio/Portal erfassen: hardcodierte Farben, Komponenten-Inventar, Migrationsliste.

**Output:** `docs/design/uwe-current-design-audit.md`, Ergänzungen in `theme-migration-notes.md`

**Branch-Vorlage:** `cursor/uwe-design-audit-ce5c`

**Gate:** Keine Implementierung — nur Audit.

---

### Schritt 3 — License Agent (parallel)

**Ziel:** AGPL-Risiko bewerten, erlaubte vs. verbotene Übernahmen, keine Odysseus-Lizenz im privaten Deploy-UI nötig.

**Output:** `docs/design/odysseus-license-risk.md`

**Branch-Vorlage:** `cursor/odysseus-license-risk-d716`

**Gate:** Rechtliche Klarheit vor Architektur.

---

### Schritt 4 — Theme Architecture (nach 1/2/3)

**Ziel:** Token-System, Presets, SSR-Bootstrap, `ThemeProvider`, Storage pro App-Scope.

**Output:** `packages/shared-ui/src/theme/*`, `uwe.css` Token-Layer

**Branch-Vorlage:** `cursor/uwe-theme-system-3a6e` → **merged als #107**

**Gate:** `pnpm quality`, keine `odysseus-*` Theme-IDs im Code.

---

### Schritt 5 — Theme Picker (nach 4)

**Ziel:** Settings-UI für Theme, Font, Density, Background, Frosted Glass, UI-Scale.

**Output:** `ThemeSettingsPanel`, Studio `/settings?tab=appearance`

**Gate:** SSR-safe, `localStorage` pro Scope (`studio` / `portal`).

---

### Schritt 6 — Component Migration (nach 4, teilweise parallel zu 5)

**Ziel:** Hardcodierte `rgba`/`#hex` in `uwe.css`, `globals.css`, `wiki.css` und Komponenten durch `--uwe-*` ersetzen.

**Output:** Migrierte CSS/Komponenten, optional `scripts/migrate-theme-colors.mjs`

**Branch-Vorlage:** `cursor/theme-migration-9075`

**Gate:** Keine visuellen Regressionen; Lint sauber.

---

### Schritt 7 — Visual Polish (nach 4/5)

**Ziel:** Scrollbars, Motion, erweiterte Patterns, `VisualThemePreview`, `uwe-visual-polish.css`.

**Branch-Vorlage:** `cursor/visual-polish-d347`

**Gate:** `prefers-reduced-motion` respektieren.

---

### Schritt 8 — Mobile & Accessibility (nach 5/6/7)

**Ziel:** Kompakter `ThemePicker`, Touch-Targets ≥44px, Fokus-Ringe, `theme-a11y-checklist.md`.

**Branch-Vorlage:** `cursor/theme-mobile-a11y-f8d7`

**Gate:** WCAG 2.2 AA Ziel für Theme-UI.

---

### Schritt 9 — QA Regression (am Ende)

**Ziel:** Manueller + automatisierter Smoke-Check aller Presets, Portal/Studio, Hydration.

**Output:** `docs/design/theme-qa-report.md`

**Branch-Vorlage:** `cursor/theme-qa-report-4d71`

**Gate:** `pnpm quality` grün, Checkliste in `theme-migration-notes.md` abgehakt.

---

### Schritt 10 — Documentation (parallel ab 4, final nach 9)

**Ziel:** `uwe-theme-system.md` aktualisieren, Orchestrierung finalisieren, Verweise auf QA-Report.

**Output:** `docs/design/uwe-theme-system.md`, `theme-orchestration.md` (dieses Dokument)

**Gate:** Docs spiegeln tatsächlichen Code auf `main`.

---

## PR-Merge-Reihenfolge (abgeschlossen)

| # | PR | Schritt |
|---|-----|---------|
| #107 | `cursor/uwe-theme-system-3a6e` | 4 + 5 + Basis-Docs |
| #123 | `cursor/uwe-design-audit-merge-3a6e` | 1–3 (Design Audit + Orchestrierung) |
| #124 | `cursor/theme-migration-merge-3a6e` | 6 Component Migration |
| #125 | `cursor/visual-polish-merge-3a6e` | 7 Visual Polish |
| #126 | `cursor/theme-mobile-a11y-merge-3a6e` | 8 Mobile & A11y |
| #127 | `cursor/theme-qa-report-merge-3a6e` | 9 QA Regression |
| #128 | `cursor/theme-docs-final-3a6e` | 10 Documentation final |

**Bereits merged (separat):** #106 (Feature-Porting-Orchestrator)

**Nicht in dieser Pipeline:** Odysseus Feature Ports (#114–#120) — separater Track mit AGPL-Native-Review.

## Quality Gate (jede PR)

```bash
pnpm install --frozen-lockfile
pnpm quality
```

Siehe `.cursor/skills/ci-quality-gate/SKILL.md` und `AGENTS.md`.

## AGPL-Regeln (alle Agents)

- Odysseus = Produkt-/UX-Inspiration, **kein** Copy-Paste
- UWE-native Theme-IDs (`uwe-default`, nicht `odysseus-dark`)
- Palette-Werte bewusst abweichend dokumentieren
- Keine Odysseus-Lizenz im privaten Website-UI erforderlich (siehe License-Doc)
