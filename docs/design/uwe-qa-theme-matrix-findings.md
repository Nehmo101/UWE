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

## Bearbeitungsstand (2026-06-25)

Kontrastdefekte **50 → 19** (−62 %), jeder Schritt per voller QA-Matrix (72/72) + Unit-Tests verifiziert:

| WP | PR | Ergebnis |
|----|----|----------|
| **P0 Primary-Buttons** | [#259](https://github.com/Nehmo101/UWE/pull/259) | abgeleiteter `--uwe-on-accent`-Token (V1+V2) → **29 → 0** Button-Verstöße |
| **P1 Links** | [#260](https://github.com/Nehmo101/UWE/pull/260) | abgeleiteter `--uwe-link`-Token + globale `a`-Regel → Link-Knoten **71 → 14** |
| **P1 Muted/Subtle** | [#261](https://github.com/Nehmo101/UWE/pull/261) | Parchment `fgMuted`/`fgSubtle` auf AA (4.41→6.3 / 2.46→5.0) |

### Verbleibend (19) — systemisch, eigene WP empfohlen
Konzentriert auf die **zwei hellen Parchment-Themes** (`uwe-parchment-study`, `uwe-parchment-os`): `<h3>`-Sektions­überschriften, Body-`<p>`, Breadcrumb-Separator, `.uwe-cockpit-tag-accent`-Chips, Form-Labels/`select`, `dt`/`li`. Das ist eine breite Text-Kontrast-Schwäche der Parchment-Paletten → **dedizierte „Parchment-AA-Überholung"** (systematisches Abdunkeln der Text-Tiers vs. Palette-Neuabstimmung — Design-Entscheidung), kein Einzel-Token-Fix.

## Ursprüngliche Empfehlung (erledigt P0/P1)

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
