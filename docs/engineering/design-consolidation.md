# Design-Konsolidierung — Arbeitsplan & Regeln

> Stand: 2026-07-10 · Grundlage: [UI-Assessment](ui-assessment.md) (181 Seiten, häufigste Schwäche: Mix aus drei Styling-Generationen) · Verbindliche Ziel-Referenz: [docs/design/new-ui-stack.md](../design/new-ui-stack.md)

## Ziel

Jede Seite nutzt **eine** Styling-Generation: Tailwind-Utilities + Kit-Komponenten aus
`apps/<app>/src/components/ui/*` (shadcn-Stil, Radix, Lucide). Die Generationen
Legacy-`uwe-*` (uwe.css/uwe-components.css), `uwe-v2-*` (design-v2) und Portal-`auth-*`/`portal-*`
werden **seitenweise** abgelöst — niemals CSS global löschen, bevor alle Nutzer migriert sind
(Migrationsregel 7 in new-ui-stack.md).

## Ist-Stand messen

```bash
node scripts/design-consolidation-inventory.mjs            # Zusammenfassung
node scripts/design-consolidation-inventory.mjs --json     # pro Seite
node scripts/design-consolidation-inventory.mjs --app portal
```

Stand heute: Studio 148 Seiten (88 gemischt, 27 legacy, 6 v2), Portal 33 Seiten (21 legacy).
Achtung: Das Script zählt nur `page.tsx` — Seiten, deren UI in Komponenten lebt
(`apps/*/components/**`), zählen erst als fertig, wenn auch diese Komponenten migriert sind.

## Definition of Done (pro Seite)

1. Keine `uwe-*`-, `uwe-v2-*`-, `auth-*`-, `portal-*`-Klassen mehr in page.tsx **und** ihren
   seitenspezifischen Komponenten (geteilte Shell-Komponenten ausgenommen, solange sie nicht dran sind).
2. Höchstens 2 `style={{…}}`-Inline-Styles (nur für echt dynamische Werte wie Prozentbreiten).
3. Komponenten aus dem Kit (`Button`, `Card`, `Badge`, `Input`, `Select`, `Tabs`, `EmptyState`,
   `ErrorState`, `LoadingState`, `DataTable` …) — keine neuen Bespoke-Elemente.
4. Icons über Lucide (`icon.tsx`-Resolver), keine Emoji/Unicode-Glyphen.
5. Farben/Abstände über Tailwind-Tokens (bridged auf `--uwe-*`) — keine Hex/RGBA-Literale.
6. Verhalten unverändert: Server Actions, Datenzugriffe, dm_only-/RBAC-Logik nicht anfassen.
7. `pnpm ci:light` grün; Seite im Dev-Server gegen mindestens 1 Theme gesichtet (hell + dunkel wenn möglich).

## Mapping-Spickzettel

| Alt | Neu |
|---|---|
| `uwe-panel`, `uwe-v2-card`, `uwe-today-card` | `<Card><CardHeader><CardTitle>…</CardTitle></CardHeader><CardContent>…` |
| `uwe-v2-btn[-primary/-secondary/-ghost/-sm/-danger]` | `<Button variant="default/secondary/ghost/destructive" size="sm">` |
| `uwe-badge[-published/-secret/-draft]` | `<Badge variant="…">` (Varianten in badge.tsx prüfen/ergänzen) |
| `uwe-page-table`, `uwe-table` | kleine Tabellen: semantisches `<table>` mit Tailwind; große Listen: `DataTable` |
| `uwe-form-grid`, `uwe-brain-create-form`, `uwe-v2-form` | Kit-`Input`/`Label`/`Select` + `grid gap-3` Utilities |
| `uwe-dashboard-muted`, `uwe-hint`, `auth-muted` | `text-muted-foreground text-sm` |
| `uwe-form-error` | `ErrorState` bzw. `text-destructive` + `role="alert"` |
| `uwe-flash uwe-flash-success` | Toast (Sonner) wo client-seitig; sonst `Alert`-Pattern aus states.tsx |
| `uwe-list-cards`/`uwe-list-card` (Übergangs-CSS) | `<ul className="grid gap-2">` + `Card`-basierte Zeilen |
| `style={{ marginTop: "1rem" }}` u. ä. | `mt-4` etc. |
| Portal `auth-block`, `portal-content-card` | Kit-`Card` im Portal (`apps/portal/src/components/ui`) |

Fehlt dem Kit etwas (z. B. eine Badge-Variante), wird es **im Kit ergänzt** (copy-in, klein),
nicht per Ad-hoc-CSS gelöst.

## Arbeitspakete & Ownership

Parallelarbeit nur mit **disjunkten Datei-Scopes**. Aktuelle Aufteilung:

| Paket | Scope | Owner | Branch |
|---|---|---|---|
| P1 Portal komplett | `apps/portal/**` (21 Legacy-Seiten + Portal-Kit) | Cursor-Agent | `cursor/design-portal` |
| S1 Studio Daily-Admin | `apps/studio/app/{finance,household,contracts,documents,ideas,bugs,jobs,projects}/**` | Claude-Session | `claude/site-ui-assessment-5ay1ow` |
| S2 Studio Kitchen+Workshop | `apps/studio/app/{kitchen,workshop,miniatures}/**` | Claude-Session | dito |
| S3 Studio Admin/System | `apps/studio/app/{admin,system}/**` | Claude-Session | dito |
| S4 Studio Worlds | `apps/studio/app/worlds/**` | Claude-Session | dito |
| S5 Studio Rest + geteilte Komponenten | `apps/studio/{components,src/components}/**`, Top-Level-Seiten | Claude-Session, zuletzt | dito |

Regeln für alle Owner:
- **Nie** Dateien außerhalb des eigenen Scopes ändern. Gemeinsame Dateien
  (`packages/shared-ui/**`, `packages/**` allgemein) ändert in dieser Phase **niemand** —
  Bedarf wird als TODO im PR/Commit-Text notiert.
- Kleine Commits pro Seitengruppe, Commit-Message-Präfix `style(scope): …`.
- Vor jedem Push: `pnpm ci:light`.
- Fortschritt messbar machen: Inventar-Script vorher/nachher in die Commit-Message.

## Reihenfolge / Risiko

1. Zuerst flächige, in sich geschlossene Seiten (Daily Admin, Kitchen, Admin) — mechanisch, wenig Risiko.
2. Danach Worlds (viele geteilte Komponenten unter `apps/studio/components/**`).
3. Geteilte Shell/`packages/shared-ui` zuletzt und als eigener, reviewter Schritt.
4. Legacy-CSS-Dateien (`uwe.css` & Co.) erst schrumpfen, wenn das Inventar für alle Nutzer-Seiten 0 meldet.
