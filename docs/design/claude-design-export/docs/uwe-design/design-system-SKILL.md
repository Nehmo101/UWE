---
name: uwe-design
description: Use this skill to generate well-branded interfaces and assets for UWE (Universeller Welten-Editor) — a self-hosted Daily Admin OS + D&D campaign editor with a German-language UI — either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation
- **Signature theme:** Parchment OS — warm paper (`#f1e8d4`), ink text (`#211d17`), terracotta accent (`#c2622b`), teal links, dark-ink sidebar. Default UI font **Space Mono**; headings **Newsreader** (serif). Set `<html data-uwe-theme="uwe-parchment-os">`.
- **Tokens:** link `styles.css`; everything is a `--uwe-*` custom property. Swap `data-uwe-theme` for any of 9 themes.
- **Components:** compiled to `_ds_bundle.js` → `window.UWEDesignSystem_f43eab` (Button, Card, StatCard, Badge, Tag, EmptyState, Input/Textarea/Select, VisibilityBadge, PageTypeBadge, RtxStatusBadge, SecretReveal, PageHeader, Breadcrumb, SidebarNav, Brand). See each component's `.prompt.md`.
- **Icons:** Lucide (CDN). No emoji.
- **Voice:** German UI, informal *du*, honest/technical tone, "GM" not "DM". Visibility is the core concept: Privat / Nur GM / Portal sichtbar / Share-Link.
- **Products:** UWE Studio (DM cockpit) and UWE Portal (player wiki) — see `ui_kits/`.
