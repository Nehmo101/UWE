# Theme & Accessibility Checklist (UWE Mobile)

Stand: Juni 2026 — Mobile & Accessibility Agent Pass

Diese Checkliste dokumentiert den Prüfstand des Theme-/UI-Systems für **UWE Studio**, **UWE Portal** und gemeinsame Komponenten in `@uwe/shared-ui`.

## Umgesetzt in diesem Pass

### Touch Targets (≥ 44px)

| Bereich | Status | Details |
|---------|--------|---------|
| Buttons / Formulare | ✅ | `--uwe-touch-min: 2.75rem` in `uwe.css` |
| Bottom Navigation | ✅ | `min-height: 3.25rem` pro Item |
| Theme Picker Swatches | ✅ | Swatch 2.75rem, Option min-height touch-min; Mobile: volle Zeilen |
| Capture FAB | ✅ | 3.25rem + safe-area Offset über Bottom Nav |
| Command Palette Items | ✅ | Mobile `min-height: var(--uwe-touch-min)` |
| Filter Sheet Toggle | ✅ | touch-min auf Toggle |

### Kontrast & Theme-Tokens

| Bereich | Status | Details |
|---------|--------|---------|
| Dark (Standard) | ✅ | Semantische Tokens: success, warning, danger, DM-only, player-visible |
| Light | ⚠️ Teilweise | Shell-Hintergrund + Reader-/Badge-Tokens; viele Komponenten noch hardcoded dark |
| System | ⚠️ Teilweise | `html[data-theme="system"]` + `prefers-color-scheme: light` für Shell/Badges |
| Wiki Reader | ✅ | `--uwe-reader-fg` / `--uwe-reader-heading` in Studio & Portal `wiki.css` |
| DM-only / Player-visible Badges | ✅ | Kontrast leicht erhöht (`#fecaca` statt `#fca5a5` für GM) |

### Tastatur

| Bereich | Status | Details |
|---------|--------|---------|
| Theme Picker | ✅ | Native Radio-Gruppe: Tab + Pfeiltasten |
| Fokus sichtbar | ✅ | `:focus-visible` für Buttons, Nav, Palette, FAB, Formulare |
| Command Palette Escape | ✅ | Schließt Modal |
| Filter Sheet Escape | ✅ | Schließt Sheet |
| Sidebar Drawer Escape | ✅ | Schließt Drawer |
| Sidebar Drawer Focus Trap | ✅ | Tab-Zyklus + Rückfokus auf Toggle |
| Filter Sheet Focus Trap | ✅ | Initialer Fokus auf Schließen, Tab-Zyklus |
| Command Palette Focus Trap | ✅ | Tab-Zyklus innerhalb des Dialogs |
| Skip Link | ✅ | „Zum Inhalt springen“ in `AppShell` |

### Screenreader

| Bereich | Status | Details |
|---------|--------|---------|
| Theme Swatches | ✅ | `aria-label` pro Option mit Beschreibung |
| Aktive Theme-Auswahl | ✅ | „Aktiv ausgewählt“ (visually hidden) |
| Visibility Badges | ✅ | `aria-label` mit voller Sichtbarkeits-Erklärung |
| Bottom Nav | ✅ | `aria-label`, `aria-current="page"` |
| Capture FAB | ✅ | `aria-label="Schnell erfassen"` |
| Command Palette | ✅ | `role="dialog"`, `aria-modal`, `aria-controls`, `aria-describedby` |
| Filter Sheet | ✅ | `role="dialog"`, `aria-modal="true"`, Focus Trap |
| GraphView-Knoten | ✅ | `aria-label` pro SVG-Link (Titel + Kategorie) |

### Motion

| Bereich | Status | Details |
|---------|--------|---------|
| `prefers-reduced-motion` | ✅ | Globale Reduktion von Animationen/Transitions in `uwe.css` |

### Mobile Layout

| Bereich | Status | Details |
|---------|--------|---------|
| Safe Area Insets | ✅ | top/bottom via `--uwe-safe-*` |
| Bottom Nav Abstand | ✅ | Main-Padding + FAB-Offset |
| Theme Picker Mobile | ✅ | Einspaltige Liste (Sheet-ähnliche Zeilen) |
| Horizontales Scrollen | ⚠️ | `overflow-x: clip` auf `.uwe-shell`; Tabellen/Code in Wiki weiterhin horizontal scrollbar (absichtlich) |

---

## Optionale Verbesserungen (kein Produkt-Backlog)

### Keyboard & Fokus

- [ ] **Command Palette Combobox-Muster**: Aktuell `listbox` + `option`; WAI-ARIA Combobox wäre semantisch korrekter.

### Screenreader

- [ ] **Wiki HTML-Inhalt**: `dangerouslySetInnerHTML` — Überschriftenstruktur/Alt-Texte abhängig vom Autor.
- [ ] **Bottom Nav Icons**: Emoji/Text — uneinheitliche Vorlese-Aussprache je Plattform.

### Mobile UX

- [ ] **Bottom Nav Abdeckung**: Nicht alle Studio-Welt-Routen und Portal-Wiki-Reader haben Bottom Nav (siehe `docs/ARCHITECTURE.md`).
- [ ] **FAB + Sticky Action Bar**: Auf sehr kleinen Screens kann es an unterem Rand eng werden.
- [ ] **Portal Wiki Reader**: Kein Bottom Nav auf `/worlds/.../[category]/[slug]`.

### Erledigt (nicht mehr Backlog)

- Portal Theme-Sync (`ThemeDocumentSync`, PR #239)
- E2E Accessibility (`pnpm test:e2e:a11y`, PR #243)
- Automatisierter Kontrast-Audit (axe-core Theme-Matrix, PRs #259–#260)

---

## Manuelle QA (Kurz)

1. **Theme Picker** (Studio → Einstellungen → General): Tab durch Dark/Light/System, Enter/Space wählen, Speichern, Reload — `data-theme` auf `<html>` prüfen.
2. **Command Palette** (⌘/Ctrl+K): Escape schließt; Tab bleibt im Dialog; Fokus-Ring sichtbar.
3. **Mobile 375px**: Bottom Nav nicht verdeckt; FAB erreichbar; kein unerwartetes horizontales Scrollen auf Dashboard.
4. **Reduced Motion**: OS-Einstellung aktivieren — Sidebar/Palette/Spinner ohne merkliche Animation.
5. **Wiki Reader**: Fließtext und Überschriften in Dark und Light lesbar.

---

## Relevante Dateien

| Datei | Zweck |
|-------|-------|
| `packages/shared-ui/src/ThemePicker.tsx` | Barrierefreier Theme-Picker |
| `packages/shared-ui/src/uwe.css` | Tokens, focus-visible, reduced-motion, Theme-Picker-Styles |
| `packages/shared-ui/src/uwe-native-select.css` | Popup-Farben des nativen `<select>` (ungelayert, Escape-Hatch `--uwe-select-bg`) |
| `packages/shared-ui/src/useFocusTrap.ts` | Focus Trap Hook (Sidebar, Filter, Palette) |
| `packages/shared-ui/src/CommandPalette.tsx` | Focus Trap, ARIA |
| `packages/shared-ui/src/MobileComponents.tsx` | Bottom Nav, Filter Sheet |
| `packages/shared-ui/src/GraphView.tsx` | Graph-Knoten `aria-label` |
| `packages/shared-ui/src/AppShell.tsx` | Skip Link, Sidebar Focus Trap |
| `apps/studio/app/layout.tsx` | `data-theme` aus DB |
| `apps/studio/app/settings/page.tsx` | Theme Picker Integration |
| `apps/studio/app/wiki.css` / `apps/portal/app/wiki.css` | Reader-Tokens |

---

## v3-Redesign — automatisierte Prüfung (Juli 2026)

Diese Checkliste war bis hierher Handarbeit. Seit dem v3-Redesign prüft
`e2e/studio-a11y.spec.ts` und `e2e/portal-a11y.spec.ts` dieselben Punkte
maschinell — Seiten × 390/768/1440 px × hell/dunkel, plus ein eigener Block mit
`hasTouch`.

`e2e/helpers/shell-audit.ts` deckt ab, was axe **nicht** sieht: waagerechtes
Scrollen, Schrift unter 12 px, zu kleine Trefferflächen und eine Sprungmarke,
die ins Leere zeigt.

### Schwellen

| Prüfung | Wert | Herkunft |
|---|---|---|
| Schriftgröße | ≥ 12 px | `--uwe-text-2xs`, der Boden des v3-Maßstabs |
| Trefferfläche, alle Viewports | ≥ 24 px | WCAG 2.2, 2.5.8 (AA) |
| Trefferfläche, `pointer: coarse` | ≥ 44 px | WCAG 2.2, 2.5.5 (AAA) — durchgesetzt in `design-v3/controls.css` |

Die 44 px gelten bewusst nur auf Touch-Geräten. Ein pauschaler Wert hätte jede
dichte Werkzeugleiste im Studio aufgebläht, ohne einen Mausnutzer zu schützen.

### Drei Kaskadenfallen, die dabei aufgefallen sind

Jede kostete einen halben Prüflauf und ist deshalb hier festgehalten:

1. **Tailwind-Utilities verlieren gegen ungelayerte Regeln.**
   `a:not(.uwe-button-surface)` in `uwe.css` ist ungelayert, `text-…`-Utilities
   liegen in `@layer utilities`. Eine Farbe an der Komponente kommt gegen die
   globale Linkregel **nie** an, egal wie spezifisch. Betroffen waren die
   Sidebar-Links (2,15:1) und der aktive Tab-Badge (Teal auf Terrakotta).
   Der etablierte Ausweg ist der Marker `.uwe-button-surface` an allem, was
   als *Fläche* gerendert wird.
2. **Sidebar-Farben außerhalb der Sidebar.** `.uwe-sidebar-section` wird auch
   im Kontextpanel verwendet, das auf hellem Papier liegt. Die
   Sidebar-Mutedfarbe ergab dort 2,98:1. Regeln, die eine Farbe an eine Fläche
   binden, müssen auf diese Fläche eingegrenzt sein.
3. **`bg-transparent` auf einem nativen `<select>`.** Das aufgeklappte Menü ist
   kein DOM — Chrome und Firefox malen die Liste selbst und nehmen dafür die
   Farben des Steuerelements. Ohne deckende Fläche fällt der Browser auf sein
   eigenes Weiß zurück, während die Optionen die helle Theme-Schrift erben:
   im dunklen Theme hell auf weiß. Beim `<input>` daneben ist dieselbe Klasse
   harmlos, deshalb war sie überall mitkopiert (94 Selects in Studio, Portal
   und `shared-ui`). Korrigiert in `uwe-native-select.css` — ungelayert, damit
   die Regel gegen `@layer utilities` gewinnt. Wer für ein einzelnes Feld eine
   andere Fläche braucht, setzt `--uwe-select-bg` (bzw. `--uwe-select-fg`),
   nicht eine `bg-`-Utility. Fixiert in `uwe-native-select.test.ts`.

### Bekannt, nicht geändert

`--uwe-on-accent: #fbf5e6` auf dem Studio-Terrakotta `#c2622b` ergibt **3,80:1**
und bestünde AA für normalen Text nicht. Der Wert stammt aus dem Design-Handoff
und gilt nur im `AppAccentScope` — den die Studio-Shell nicht verwendet; dort
leitet die Theme-Engine Schwarz ab (5,08:1, besteht). Auf den geprüften Routen
tritt die Paarung nicht auf. Vor einer Änderung sollte geklärt werden, wo sie
tatsächlich gerendert wird — eine Umstellung auf dunkle Schrift wäre eine
sichtbare Designentscheidung, keine reine Korrektur.

### Was die Matrix zusätzlich prüft (Stand: 22 migrierte Tabellen)

Seit der Tabellen- und Zustandsrunde kommen zwei Prüfungen dazu:

- **Genau eine `h1` je Seite.** Aufgefallen im Welt-Cockpit, wo `PageHeader`
  und `WorldCockpitHeader` denselben Weltnamen untereinander als `h1`
  rendereten. Zwei Seitenüberschriften sind kein Schönheitsfehler: die
  Gliederung hat dann keine eindeutige Spitze.
- **Die Matrix deckt jetzt sechs Studio-Seiten ab** (`/worlds`, `/settings`,
  Label-Bibliothek, Welt-Cockpit, `/templates`, `/continue`) und prüft das
  Cockpit zusätzlich über alle drei Viewports und beide Themes.

### Trefferflächen in Text — zwei Regeln, kein Pauschalwert

`--uwe-touch-aa` (24 px) steht seit dieser Runde neben `--uwe-touch-min`
(44 px). Zwei Stellen setzen ihn ein, beide bewusst eng gefasst:

| Regel | Wo | Warum nicht breiter |
|---|---|---|
| `.uwe-table-v3 :is(td, th) :is(a, button)` | `design-v3/data.css` | Der Verweis in der Zelle *ist* das Ziel der Zeile. Der Innenabstand der Zelle zählt nicht — gemessen wird der Anker. |
| `.uwe-sidebar-section li :is(a, button)` | `design-v3/controls.css` | Eine Zeile, ein Ziel. Auf `li` beschränkt, damit ein Verweis mitten im Satz seine Zeilenhöhe behält. |

Ein pauschales `a { min-height }` wäre die bequemere Regel und die falsche:
es risse jeden Fließtextabsatz auseinander, in dem ein Link vorkommt.
