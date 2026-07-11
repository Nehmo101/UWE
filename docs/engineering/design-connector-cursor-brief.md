# Cursor-Arbeitsauftrag: RTX-Connector auf Ziel-Stack (Paket C)

**Scope: ausschließlich `apps/rtx-connector-client/**`.** Kein Edit in
`packages/**`, `apps/studio/**`, `apps/portal/**`, `scripts/**` — dort arbeitet
parallel eine andere Session. Branch: **`cursor/design-connector`** (von
`origin/main` abzweigen, falls nicht vorhanden). Kein PR erstellen — nur
pushen; der Merge wird zentral koordiniert.

## Ziel

Der Tauri/Vite-Connector ist der letzte Nutzer der Design-V2-Schicht
(`ButtonV2`, `CardV2`) und des Legacy-CSS-Bundles
(`import "@uwe/shared-ui/uwe.css"` in `src/main.tsx`). Nach diesem Paket ist er
self-contained auf dem Ziel-Stack (Tailwind v4 + copy-in Kit-Primitives, siehe
`docs/design/new-ui-stack.md`), und die V2-Schicht kann zentral abgerissen
werden (macht die andere Session — **nicht** Teil dieses Auftrags).

## Ist-Zustand (verifiziert)

- `src/main.tsx` importiert `@uwe/shared-ui/uwe.css` (liefert die `--uwe-*`
  CSS-Token) und `./app.css` (551 Zeilen bespoke Connector-Styling).
- `index.html` pinnt `data-uwe-theme="uwe-parchment-os"` — es gelten die
  **Parchment-OS-Tokenwerte** aus den
  `html[data-uwe-theme="uwe-parchment-os"]`-Blöcken in
  `packages/shared-ui/src/uwe.css` (ab ~Zeile 2085), nicht die dunklen
  `:root`-Defaults.
- 16 Panels + `SetupWizard` + `App.tsx` nutzen `ButtonV2`/`CardV2` (~174
  Verwendungen) und `HealthBadge` aus `@uwe/shared-ui`.
- Kein Tailwind im Vite-Setup; Navigation über `ConnectorShell` +
  `connector-nav.ts` (bleibt unverändert).

## Arbeitsschritte

1. **Tailwind v4 einrichten:** `@tailwindcss/vite`-Plugin in `vite.config.ts`,
   neue `src/styles/globals.css` analog zu `apps/studio/app/globals.css`:
   `@layer`-Deklaration, `@import "tailwindcss/theme.css" layer(theme)` +
   `utilities.css layer(utilities)` (KEIN Preflight), `@source "../"`,
   `@theme`-Block mit derselben Token-Bridge wie Studio/Portal
   (`--color-background: var(--uwe-bg)` usw. — Tabelle in
   `docs/design/new-ui-stack.md#token-bridge`, plus success/warning/info wie im
   Portal).
2. **Eigene Token-Datei:** `src/styles/tokens.css` mit einem `:root`-Block, der
   die heute effektiv geltenden **Parchment-OS-Werte** aller vom Connector
   genutzten `--uwe-*`-Variablen definiert (Werte aus
   `packages/shared-ui/src/uwe.css` ablesen: Basis-`:root` ab Zeile 23, dann
   Parchment-Overrides ab ~2085/1743 drüberlegen; übernehmen, was im Browser
   für `data-uwe-theme="uwe-parchment-os"` resolved). Danach das
   `data-uwe-theme`-Attribut in `index.html` entfernen — der Connector ist
   nicht mehr vom shared-ui-Theme-System abhängig.
3. **Kit-Primitives copy-in:** `src/components/ui/{cn.ts,button.tsx,card.tsx}`
   aus `apps/studio/src/components/ui/` kopieren (Button/buttonVariants, Card-
   Familie, cn). Nur was gebraucht wird — kein Radix nötig, der Connector hat
   keine Dialoge aus dem Kit.
4. **Panels migrieren** (Batches à 3–5 Dateien, je ein Commit
   `style(connector): …`): `ButtonV2` → `Button`/`buttonVariants`, `CardV2` →
   `Card/CardHeader/CardTitle/CardContent`. Props-Mapping: V2-`variant`/`size`
   sinngemäß auf Kit-Varianten; Verhalten (onClick, disabled, Busy-Zustände)
   byte-identisch lassen. `HealthBadge` weiter aus `@uwe/shared-ui`
   importieren (ist bereits migriert und bleibt).
5. **`app.css` verschlanken:** Regeln, die nur V2-/uwe-Klassen stylen oder
   durch Utilities ersetzt wurden, entfernen; Shell-/Layout-Styling des
   `ConnectorShell` darf bespoke bleiben (eigenständige Desktop-App). Am Ende
   `import "@uwe/shared-ui/uwe.css"` aus `main.tsx` entfernen —
   `tokens.css` + `globals.css` ersetzen es.
6. **Nicht anfassen:** `ButtonV2`/`CardV2`-Quellcode oder Exporte in
   `packages/shared-ui` (Abriss macht die andere Session), `src-tauri/**`,
   Update-/Runner-Logik.

## Definition of Done

- `grep -rn "ButtonV2\|CardV2\|uwe-v2-\|@uwe/shared-ui/uwe.css" apps/rtx-connector-client/src` → 0 Treffer.
- Optik bleibt Parchment-OS-artig (heller Chrome, Ink-Akzente) — vorher/nachher
  per `pnpm --filter @uwe/rtx-connector-client dev:web` gegenprüfen.
- `pnpm --filter @uwe/rtx-connector-client build:web` grün (Exit-Code prüfen,
  nicht Log-Optik).
- Monorepo-Gate `pnpm ci:light` grün.
- Max. 2 `style={{}}` pro Datei (nur echte Laufzeitwerte).

## Konfliktvermeidung

Die parallele Session arbeitet auf `claude/site-ui-assessment-5ay1ow` in
`packages/shared-ui`, `apps/studio`, `uwe.css`. Solange dieser Auftrag strikt
in `apps/rtx-connector-client/**` (+ neue Dateien dort) bleibt, gibt es keine
Merge-Konflikte.
