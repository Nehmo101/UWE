# UWE Studio — UI kit

A high-fidelity, click-through recreation of **UWE Studio**, the DM-facing app: a
self-hosted *Daily Admin OS* fused with a D&D campaign editor. Rendered in the
default **Parchment OS** theme (warm paper + dark-ink sidebar + terracotta).

## Screens (`index.html`)
Click the sidebar to switch:
- **Heute** — the Daily Admin cockpit: stat tiles (Capture inbox, projects, next session), an "Braucht Aufmerksamkeit" queue (World Inspector findings, backup age, broken wikilinks), quick-access chips, and a KI/RTX status panel.
- **Welt Terra** — campaign world overview: stats + recently-edited pages with type + visibility badges.
- **Orte › Validori** — a wiki page with the metadata rail and a `SecretReveal` GM secret.

## Composition
Screens are in `screens.jsx` and compose design-system components (`Button`,
`Card`, `StatCard`, `PageHeader`, `Breadcrumb`, `VisibilityBadge`,
`PageTypeBadge`, `RtxStatusBadge`, `SecretReveal`, `SidebarNav`, `Brand`) from
`window.UWEDesignSystem_f43eab`. Icons are Lucide via CDN. Nothing is
re-implemented — the kit is a composition, not a fork.

## Notes
This is a cosmetic recreation for prototyping — no real data, auth, or AI. The
layout mirrors the product's `AppShell` (topbar + ink sidebar + main) and the
German UI vocabulary (Welten, NPCs, Orte, Sichtbarkeit: *Nur GM* / *Portal sichtbar*).
