---
name: uwe-design-system
description: Generate on-brand UWE interfaces and assets. Use when building/prototyping Studio or Portal UI, picking colors/type/spacing, or checking visual consistency against the Parchment OS design language.
---

# UWE Design Style Guide

The full style guide lives in [`design-system/`](../../design-system/) at the repo
root — read [`design-system/README.md`](../../design-system/README.md) first.

## Quick orientation
- **Signature theme:** Parchment OS — warm paper (`#f1e8d4`), ink text (`#211d17`),
  terracotta accent (`#c2622b`), teal links, dark-ink sidebar. Default UI font
  **Space Mono**; headings **Newsreader** (serif). Set
  `<html data-uwe-theme="uwe-parchment-os">`.
- **Tokens:** link `design-system/styles.css`; everything is a `--uwe-*` custom
  property. Swap `data-uwe-theme` for any of 9 themes (`design-system/tokens/colors.css`).
- **Components:** compiled to `design-system/_ds_bundle.js` →
  `window.UWEDesignSystem_f43eab` (Button, Card, StatCard, Badge, Tag, EmptyState,
  Input/Textarea/Select, VisibilityBadge, PageTypeBadge, EngineStatusBadge,
  SecretReveal, PageHeader, Breadcrumb, SidebarNav, Brand). See each component's
  `.prompt.md` under `design-system/components/*`.
- **Icons:** Lucide (`lucide-react` in-product, CDN in the kit). No emoji.
- **Voice:** German UI, informal *du*, honest/technical tone, "GM" not "DM" in
  copy. Visibility is the core concept: Privat / Nur GM / Portal sichtbar /
  Share-Link.
- **Products:** UWE Studio (DM cockpit) and UWE Portal (player wiki) full-screen
  recreations under `design-system/ui_kits/`.

## When building production UI

The live tokens/theme engine this guide mirrors: `packages/shared-ui/src/uwe.css`,
`src/theme/themes.ts`, `src/theme/tokens.ts`, `src/design-v2/*.css`. Prefer
`@uwe/shared-ui` components per `.cursor/skills/react-next-ui/SKILL.md`; use the
design-system guide for tokens/values and brand rules, not as a source to import
code from directly (its components are cosmetic recreations, not the production
TSX).

## When building throwaway prototypes/mocks

Copy assets out of `design-system/` and build static HTML using the tokens and
components documented there — see `design-system/SKILL.md` for the
Claude-Code-skill framing of the same guide.
