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

- [ ] **Bottom Nav Abdeckung**: Nicht alle Studio-Welt-Routen und Portal-Wiki-Reader haben Bottom Nav (siehe `docs/REPO_AUDIT.md`).
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
| `packages/shared-ui/src/useFocusTrap.ts` | Focus Trap Hook (Sidebar, Filter, Palette) |
| `packages/shared-ui/src/CommandPalette.tsx` | Focus Trap, ARIA |
| `packages/shared-ui/src/MobileComponents.tsx` | Bottom Nav, Filter Sheet |
| `packages/shared-ui/src/GraphView.tsx` | Graph-Knoten `aria-label` |
| `packages/shared-ui/src/AppShell.tsx` | Skip Link, Sidebar Focus Trap |
| `apps/studio/app/layout.tsx` | `data-theme` aus DB |
| `apps/studio/app/settings/page.tsx` | Theme Picker Integration |
| `apps/studio/app/wiki.css` / `apps/portal/app/wiki.css` | Reader-Tokens |
