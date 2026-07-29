# UWE Design System

A design system for **UWE — Universeller Welten-Editor**: a self-hosted
*Alltags- und Hobby-Betriebssystem* — a **Daily Admin OS** fused with a **D&D
campaign brain**, player portal, and optional local AI, all running on your own
hardware. It is a bilingual product with a **German-language UI**.

This repository packages UWE's real visual language — tokens, type, the
nine-theme engine, reusable components, and full-screen product recreations — so
agents can generate on-brand UWE interfaces and assets.

## Products represented

| Surface | Name | What it is |
|---|---|---|
| DM app | **UWE Studio** | World/campaign editor + Daily Admin OS + AI workflows (DM-only). Topbar + dark-ink sidebar + main. |
| Player app | **UWE Portal** | Player-facing wiki & handouts. Shows only published, player-visible content. |
| Backend | **UWE Core** | Shared data layer, auth, wiki engine (not visual). |
| Local AI | **Maschinenraum** | Optional outbound GPU worker; surfaced in the UI as an RTX status badge. |

**Domain vocabulary** (used verbatim across the UI): Welten (worlds), NPCs, Orte
(locations), Fraktionen (factions), Quests, Sessions, Handouts, Dungeons, Kanon
(canon), Brain, Capture-Inbox, Command Palette (⌘K). Visibility is the core
player-safety concept: **Privat**, **Nur GM** (dm-only), **Portal sichtbar**
(player-visible), **Share-Link**.

## Sources

Built by reading the product source (not screenshots):

- **GitHub:** `Nehmo101/UWE` — https://github.com/Nehmo101/UWE (private). A pnpm/Turborepo monorepo (Next.js 15, React 19, Prisma). Explore further to build higher-fidelity UWE designs.
  - Tokens & theme engine: `packages/shared-ui/src/uwe.css`, `src/theme/themes.ts`, `src/theme/tokens.ts`, `src/design-v2/*.css`
  - Fonts wired in `apps/studio/app/layout.tsx` (Space Mono + Newsreader via `next/font`)
  - Components: `apps/studio/src/components/ui/*`, `packages/shared-ui/src/*` (AppShell, StatusBadges, SecretReveal, UweLandingPage)
  - Icons: Lucide (`apps/studio/src/components/ui/icon.tsx`)
- A sibling repo `Nehmo101/KnoteForge` exists (the JSON import pipeline) but was not needed for the visual system.

> The reader may not have access to these repos; links are recorded for those who do.

---

## Content fundamentals

**Language & voice.** The UI is **German**; docs and code are bilingual
(German + English). Tone is **honest, technical, and unpretentious** — it reads
like a homelab operator's tool, not a marketing site. Failure states are stated
plainly rather than hidden: e.g. an offline connector shows *"einen ehrlichen
Degraded-Status — kein Crash"* and *"KI-Jobs werden vorgemerkt … kein
Cloud-Fallback."*

**Address.** Second-person informal **du** ("Wähle den passenden Einstieg",
"Öffne deine freigegebenen Welten"). Never corporate "Sie".

**Casing.** Normal German capitalisation (nouns capitalised). Section
eyebrows/labels are **UPPERCASE with wide tracking** ("SICHTBARKEIT"). Buttons
and titles are sentence case ("Welt anlegen", "Nächste Session").

**"GM" vs "DM".** The product uses **GM** in user-facing German labels ("Nur GM",
"GM-Geheimnis", "GM-Notiz") while code/docs say DM. Prefer **GM** in UI copy.

**Emoji:** none. The product never uses emoji in UI. A single geometric glyph —
**◆** — appears as the nav brand mark. Status uses colored dots + words, not
emoji.

**Microcopy examples (verbatim style):**
- "Self-hosted Kampagnen- und Admin-Cockpit."
- "Für deine Rolle sind derzeit keine Inhalte sichtbar. Wende dich an deinen Spielleiter." (empty state)
- "Cloud-KI erhält keinen Zugriff auf lokales Brain/Weltwissen." (privacy hint)
- Visibility labels: "Privat · Nur GM · Portal sichtbar · Share-Link".

**Numbers/dates:** German formats where shown ("Freitag 19:00", "1. Juli").

---

## Visual foundations

**Signature look — Parchment OS.** The product's default theme (for *both*
Studio and Portal) is **Parchment OS**: warm sand paper (`#f1e8d4`), near-black
ink text (`#211d17`), a **terracotta** accent (`#c2622b`), muted **teal** links
(`#1a5c4f` / `#2f6f63`), and a **dark-ink sidebar** (`#211d17` with sand text).
The default UI font is **Space Mono** — a monospace, giving the "admin OS /
terminal-for-a-DM" character — while **Newsreader** (serif) carries headings and
long wiki reading. It is a distinctive pairing: parchment + monospace + serif.

**Color.** Token-driven and multi-theme. Every surface/text/accent is a
`--uwe-*` custom property, so the whole product re-skins by setting
`data-uwe-theme` on `<html>`. **Nine themes** ship: Parchment OS (default), UWE
Default (slate + indigo), Dark Fantasy (navy + cyan), Charcoal Desk, Night
Observatory, Parchment Study (warm light), Phosphor Console (green terminal),
Terra (earthy green campaign), Hells (infernal crimson). Two semantics are
brand-critical: **dm-only = terracotta**, **player-visible = teal**.

**Type.** mono (Space Mono, default UI) / serif (Newsreader, headings + reader)
/ sans (system-ui, fallback). Headings use `-0.02em` tracking; eyebrows use
`0.12em` uppercase. Scale runs 10.9px (badge) → 52px (brand display); UI body is
~14.4px.

**Backgrounds.** No photographic hero imagery. A **very subtle radial wash** of
accent + info over the base, fixed. The theme engine also offers optional
patterns (dots, parchment lines, faint noise, constellation grid) at low
intensity — decorative, never loud. On paper themes, backgrounds stay flat and
quiet.

**Spacing & layout.** 4/8-based scale (xs 4 → 2xl 32). Fixed shell rhythm:
topbar **54px** (2px solid-ink bottom border on Parchment OS), sidebar **236px**,
right context rail 288px, reader measure 52rem. Mobile-first: **44px** minimum
touch targets, safe-area insets respected.

**Corners.** Radii sm 6px / md 8px / lg 12px; the v2 "Handoff" rhythm uses **9px
buttons** and **14px cards**. Nothing is pill-round except tags, chips, and
status dots.

**Cards.** Elevated paper (`#fbf6ea`) with a **1.5px** border (`#e0d4ba`), 14px
radius, and a *subtle* shadow (`0 1px 2px rgba(0,0,0,.22)`). Hover lifts the
border toward the accent. No colored left-border accent cards, no gradient card
fills.

**Borders & shadows.** Borders are warm and low-contrast on paper. Shadows are
theme-agnostic dark drops (sm/md/lg) used sparingly — the aesthetic leans on
**borders and ink weight**, not heavy elevation.

**Buttons.** `primary` = **solid ink fill** (`--uwe-fg`) with paper-colored text
(the Parchment OS signature); `accent` = **terracotta fill with a 2px ink
border**; plus secondary / subtle / ghost / danger. 9px radius.

**Hover / press / focus.** Hover: border shifts toward accent + a faint
accent-tinted background wash (~8–12%); links darken/underline. Press: a 1px
downward nudge (`translateY(1px)`) — no scale bounce. Focus: 2px accent outline
+ 2px offset, plus a soft accent glow ring.

**Motion.** Short and functional: **0.12–0.15s ease** transitions on
color/border/background. No bounce, no long or infinite decorative animations.
Reduced-motion friendly.

**Transparency & blur.** Optional **frosted glass** on chrome/cards in some
themes (`backdrop-filter: blur(12–14px) saturate(1.05)`), used on topbars,
sidebars, and auth cards — subtle, not glassy-everywhere. Paper themes mostly
render solid.

**Imagery vibe.** Warm, earthy, analog — parchment, ink, terracotta, teal. When
imagery is used (maps, handouts) it reads like tabletop material, not glossy
stock photography.

---

## Iconography

**Lucide** (`lucide-react`) is the icon system — the product resolves icons by
kebab-case name (`apps/studio/src/components/ui/icon.tsx`, falling back to a
help glyph). Stroke style, ~2px weight, 16px default in UI, currentColor stroke.

- **In this kit:** load Lucide from CDN — `https://unpkg.com/lucide@0.454.0/dist/umd/lucide.min.js` — then `<i data-lucide="map-pin"></i>` + `lucide.createIcons()`. In React (bundle components), pass a Lucide node as an `icon`/`meta` prop.
- **Common glyphs:** `home, users, map-pin, scroll-text, calendar, swords, dice-6, eye-off, cpu, command, inbox, settings, sparkles, folder-kanban, music, shield-alert`.
- **Brand mark:** the geometric **◆** diamond (nav) and a boxed-**U** wordmark glyph — see the Brand foundation card and `assets/uwe-icon.svg` (the app icon, a stylized play-triangle + dot).
- **No emoji, no icon-font, no PNG icons.** Unicode ◆ is the only glyph-as-icon used.

---

## Index / manifest

**Root**
- `styles.css` — the single entry point consumers link. `@import` manifest only.
- `README.md` — this guide.
- `SKILL.md` — Agent-Skill wrapper (usable in Claude Code).
- `assets/uwe-icon.svg` — the app icon.

**`tokens/`** (all reached from `styles.css`)
- `fonts.css` — Google-Fonts import + font-family vars (Space Mono, Newsreader).
- `typography.css` — family tokens, type scale, weights, tracking.
- `spacing.css` — spacing, radius, shadow, shell layout, motion.
- `colors.css` — Parchment OS on `:root` + all 10 themes as `[data-uwe-theme]` scopes + Portal scope.
- `base.css` — element resets + primitive defaults.

**`components/`** (React; `window.UWEDesignSystem_f43eab`)
- `core/` — Button, Card, StatCard, Badge, Tag, EmptyState
- `forms/` — Input, Textarea, Select
- `domain/` — VisibilityBadge, PageTypeBadge, RtxStatusBadge, SecretReveal
- `navigation/` — PageHeader, Breadcrumb, SidebarNav, Brand

**`ui_kits/`**
- `studio/` — UWE Studio DM cockpit (Today / World / Wiki page). `index.html` + `screens.jsx`.
- `portal/` — UWE Portal player wiki (Login / World hub / Article). `index.html` + `screens.jsx`.

**`guidelines/`** — foundation specimen cards (Colors, Type, Spacing, Brand) shown in the Design System tab.

### Using the system
Link the CSS and set a theme on `<html>`:
```html
<html data-uwe-theme="uwe-parchment-os">
<link rel="stylesheet" href="styles.css" />
```
Mount components from the compiled bundle:
```html
<script src="_ds_bundle.js"></script>
<script>const { Button, Card } = window.UWEDesignSystem_f43eab;</script>
```

---

## Caveats
- **Fonts** are loaded from **Google Fonts** (Space Mono, Newsreader) via `@import`, not self-hosted binaries — the product wires the same families through `next/font`. If you need offline/self-hosted webfonts, supply the `.woff2` files and I'll swap in `@font-face`.
- Components are **cosmetic recreations** built from the product's token values and class styles — not the exact production TSX. Values (colors, radii, spacing) are copied verbatim from source.
- UI kits abbreviate repeated content and use fake data; they demonstrate structure and interaction, not real functionality.
