# UWE Theme-Matrix Browser-QA (WP-H)

Automatisierte Browser-QA-Sweep über **9 Theme-Presets × Kern-Routen** für Studio und Portal.
Erzeugt je Kombination einen Full-Page-Screenshot und einen axe-core **Kontrast**-Scan; die
gefundenen Defekte landen als Liste in `qa-artifacts/defects.json`. Keine Blind-Fixes — P0/P1
werden als Folge-Arbeitspakete eingeplant.

Ergänzt die statische Checkliste `docs/design/uwe-qa-urls.md` und die Merge-Gate-Automation
`docs/design/uwe-qa-automation.md`.

## Presets (9)

`uwe-default` · `uwe-dark-fantasy` · `uwe-charcoal-desk` · `uwe-night-observatory` ·
`uwe-parchment-study` · `uwe-parchment-os` (Default) · `uwe-phosphor-console` · `terra` · `hells`

Quelle der Wahrheit: `packages/shared-ui/src/theme/themes.ts`.

## Kern-Routen

| Scope | Routen |
|-------|--------|
| Studio | `/today`, `/worlds/terra/dashboard`, `/worlds/terra/lore/amans-geheimnis`, `/capture`, `/search`, `/settings` |
| Portal | `/worlds`, `/worlds/terra` |

= 9 × 6 (Studio) + 9 × 2 (Portal) = **72 Kombinationen**.

## Ausführen

```bash
# Apps + Seed via Playwright webServer (scripts/e2e-servers.mjs) werden automatisch gestartet
pnpm qa:theme-matrix
```

- Setzt `QA_MATRIX=1` (sonst sind die Specs `test.skip`) und sweept
  `e2e/studio-qa-matrix.spec.ts` + `e2e/portal-qa-matrix.spec.ts`.
- Das Theme wird je Lauf über den localStorage-Key `uwe-theme-preferences-<scope>` erzwungen
  (`forceThemePreset`, `e2e/helpers/qa-matrix.ts`).
- Artefakte: `qa-artifacts/<scope>__<route>__<preset>.png` und `qa-artifacts/defects.json`
  (beide gitignored).

## Auswertung

1. `qa-artifacts/defects.json` enthält pro Eintrag `scope`, `route`, `preset`, `rule`
   (`color-contrast`), `impact`, betroffene `nodes` (HTML-Auszug).
2. Screenshots manuell auf Layout-/Lesbarkeitsdefekte sichten (Überlauf, abgeschnittene
   Badges, unlesbare Sekundärtexte je Preset).
3. Defekte triagieren:
   - **P0** — unlesbar / Funktion blockiert (z. B. Kontrast < 3:1 auf Primärtext) → sofortiger Folge-WP.
   - **P1** — sichtbarer Defekt, nicht blockierend → eingeplanter Folge-WP.
   - **P2** — kosmetisch → Backlog.

> Hinweis: Die Token-/Kontrast-Logik wird in dieser Matrix nur **gemessen**, nicht verändert.
> Fixes erfolgen als separate, fokussierte PRs pro Defektklasse.
