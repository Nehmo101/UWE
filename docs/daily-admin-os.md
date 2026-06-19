# UWE Daily Admin OS

Lasses privates Admin-Cockpit in UWE Studio — neben DnD-Welten für Projekte, Capture, Verträge, Hardware und persönliches Life-Brain.

## Routen

| Route | Zweck |
|-------|--------|
| `/today` | Daily Cockpit — System-Ampel, DnD-Favorit, Life-Admin-Karten |
| `/capture` | Schnell-Eingang (Inbox) — funktioniert ohne RTX |
| `/projects` | Persönliche Projekte (UWE, Homelab, DnD, …) |
| `/workshop` | Werkstatt-Cockpit — Projekte, Material, Fotos, Next Actions |
| `/workshop/[id]` | Projekt-Detail mit Materialien, Farben, Links, Rezepten |
| `/workshop/recipes` | Paint-Rezept-Bibliothek (wiederverwendbar) |
| `/workshop/print-profiles` | 3D-Druck-Profil-Historie |
| `/workshop/rental` | Terrain-Verleih (optional) |
| `/contracts` | Verträge & Monatsausgaben (manuell, keine Bank-Anbindung) |
| `/hardware` | Homelab-Geräte, Setup-Schritte, URL-Warnungen |
| `/life-brain` | Persönliches Brain (getrennt vom DnD-Brain) |
| `/admin/status` | Studio Security + RTX Exposure |

## Mobile Navigation

Bottom-Nav: **Heute · Capture · Suche · KI · Mehr**

Global Capture FAB in allen Studio-Views.

## Bevorzugte DnD-Welt

Reihenfolge für `/today`:

1. Studio-Einstellung `app.favoriteWorldSlug` (Settings → Worlds)
2. Umgebungsvariable `PREFERRED_WORLD_SLUG`
3. Welt mit Slug `terra`, falls vorhanden
4. Erste angelegte Welt

Terra wird **nicht** hardcodiert erzwungen — Multi-World bleibt unter `/worlds` voll nutzbar.

## KI & Generator

- **Kontext-Generator** auf Wiki-Seitenbearbeitung (`/worlds/.../edit`)
- Aktionen abhängig vom Seitentyp (NPC, Raum, Session, …)
- Alle Outputs → Review (AI Runs / Proposals), nie Auto-Apply
- RTX offline → Jobs in Warteschlange, **kein Cloud-Fallback** für lokalen Kontext

## Datenschutz

Siehe [life-brain-privacy.md](./life-brain-privacy.md).

## Tests

- `packages/database/src/life-admin-service.test.ts`
- `packages/database/src/workshop-types.test.ts`
- `packages/database/src/studio-security.test.ts`
- `apps/studio/src/lib/today-dashboard.test.ts`
- `packages/ai-brain/src/router/personal-brain-privacy.test.ts`
