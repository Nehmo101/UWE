# WP-H Theme-Matrix QA — Befund-Report (Lauf 2026-06-25)

Erzeugt durch `pnpm qa:theme-matrix` (Harness aus `docs/design/uwe-qa-theme-matrix.md`).
**Lauf:** 72/72 Kombinationen (9 Presets × Studio 6 + Portal 2), 72 Full-Page-Screenshots,
**50 axe-core `color-contrast`-Verstöße** (alle Schweregrad **serious** = WCAG 2 AA).

> Umgebung: lokal gegen die e2e-Server (`scripts/e2e-servers.mjs`, SQLite-Seed `terra`),
> Chromium 1194. Screenshots/`defects.json` sind gitignored (`qa-artifacts/`).

## Kernbefund

Die Defekte sind **preset-übergreifend nahezu identisch** — d.h. es sind **gemeinsame Design-Token-
/Komponenten-Probleme**, keine einzelnen Theme-Ausreißer. Damit lassen sie sich an wenigen
zentralen Stellen beheben.

| Cluster | Verstoß-Knoten | Presets betroffen | Triage |
|---------|---------------:|:-----------------:|:------:|
| **Links (Nav/Inline)** — `a`, `.uwe-dashboard-list`, `.uwe-back-link`, `.uwe-sidebar-back-link`, `.portal-login-link`, `.uwe-breadcrumb-sep` | 68 | **9/9** | **P1** |
| **Primary-Buttons** — `.uwe-btn-primary`, `.uwe-v2-btn-primary` (Submit „Suchen", „Erfassen", „+ Capture" …) | 29 | **8/9** | **P0** |
| Sekundär-/Muted-Text — `.uwe-dashboard-muted`, `.uwe-hint`, `.uwe-cockpit-tag-muted`, `.wiki-empty`, `.uwe-portal-hero-meta` | 10 | 3/9 | P1 |
| Überschriften/Listen/`dt` (Wiki-Detail, Suche) | 20 | 3/9 | P2 |
| Form-Labels/Selects — `.uwe-capture-field`, `select`, `input[type=search]` | 7 | 1/9 (parchment-*) | P2 |
| Accent-Tag-Chips — `.uwe-cockpit-tag-accent` | 4 | 4/9 | P2 |

(Knotenzahl > 50, da ein Verstoß mehrere DOM-Knoten umfassen kann.)

## Empfohlene Folge-WPs (keine Blind-Fixes)

- **P0 — `cursor/a11y-contrast-primary-button-adcf`**: Kontrast von Primary-Button-Text↔Hintergrund
  (Token `--uwe-accent`/`--uwe-on-accent` bzw. `.uwe-btn-primary`/`.uwe-v2-btn-primary`) auf ≥ 4.5:1
  über alle 9 Presets bringen. Höchste Sichtbarkeit (jeder Submit-Button).
- **P1 — `cursor/a11y-contrast-links-adcf`**: Link-Farbe↔Hintergrund (inkl. Back-Links, Breadcrumb-
  Separator, Dashboard-Listenlinks) auf AA. Betrifft alle Presets → zentral im Link-/`--uwe-link`-Token.
- **P1 — `cursor/a11y-contrast-muted-text-adcf`**: Sekundär-/Muted-Text-Token (`--uwe-muted`) anheben,
  v.a. `.uwe-dashboard-muted`, `.uwe-hint`, `.uwe-cockpit-tag-muted`.
- **P2**: Form-Label/Select-Kontrast (Parchment-Presets), Accent-Chips, Wiki-Detail-`dt`/Listen.

## Reproduktion

```bash
pnpm qa:theme-matrix              # 72 Kombinationen → qa-artifacts/{screenshots,defects.json}
# Browser-Pin (Build-Mismatch): executablePath auf vorinstalliertes Chromium zeigen, falls nötig.
```

Detail-Knoten (HTML-Auszüge, betroffene Route/Preset) stehen in `qa-artifacts/defects.json`.
