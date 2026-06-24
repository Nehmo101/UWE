# Parchment OS — Design Handoff

**Quelle:** `docs/design/GitHub Repository UWE-Analyse.zip` → `UWE Handoff.dc.html`  
**Stand:** Juni 2026  
**Implementierung:** `packages/shared-ui/src/design-v2/`, Theme `uwe-parchment-os`

## Farbpalette

| Token | Hex | Verwendung |
|-------|-----|------------|
| ink | `#211D17` | Text, Rahmen, Sidebar-Hintergrund |
| amber | `#C2622B` | Primär-Akzent, aktive Nav, DM-Label |
| teal | `#2F6F63` | Spieler-Portal, OK-Status |
| gold | `#E0B15A` | Warnungen |
| parchment | `#F1E8D4` | App-Hintergrund |
| card | `#FBF6EA` | Karten |
| panel | `#ECE1C9` | Topbar, Panels |
| border | `#E0D4BA` | Kartenrahmen |
| muted | `#9A8F78` | Labels, dezente Texte |
| online | `#6EE787` | Status-Punkt „gespeichert“ |

## Layout

| Element | Wert |
|---------|------|
| Sidebar (offen) | 236px |
| Sidebar (collapsed) | 66px |
| Topbar | 54px |
| Sidebar BG | ink (`#211D17`) |
| Sidebar aktiv | `#2C261D` + 3px amber links |
| Lesebreite | max. 52rem |

## Radien & Rahmen

| Element | Wert |
|---------|------|
| Button | 9px, `btn-primary` 2px ink border optional |
| Karte | 14px, 1.5px `border` |
| Hero-Karte | 16px, 2px ink |
| Nav-Icon | 7px |

## Buttons

| Variante | Stil | Einsatz |
|----------|------|---------|
| `btn-primary` | ink BG, card Text | Standard-Aktionen |
| `btn-accent` | amber BG, 2px ink border | Session vorbereiten, Generieren |
| `btn-outline` | transparent, 1.5px ink | Sekundär |

## Abnahme-Screens

Referenzbilder in `docs/design/scraps/`:

- `today-desktop.png` — `/today` Desktop
- `today-mobile.png` — `/today` Mobile (Bottom-Nav)

Vollständige URL-Liste: `docs/design/uwe-qa-urls.md`

## Zip-Inhalt

| Datei | Zweck |
|-------|-------|
| `UWE Handoff.dc.html` | Token- und Komponenten-Spezifikation (maßgeblich) |
| `UWE Prototype.dc.html` | Interaktiver Prototyp |
| `UWE Design System.dc.html` | Komponenten-Bibliothek |
| `scraps/*.png` | Abnahme-Screens |
