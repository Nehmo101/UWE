# UWE Daily Admin OS

Lasses privates Admin-Cockpit in UWE Studio — neben DnD-Welten für Projekte, Capture, Verträge, Hardware und persönliches Life-Brain.

## Routen

| Route | Zweck |
|-------|--------|
| `/today` | Daily Cockpit — System-Ampel, DnD-Favorit, Life-Admin-Karten |
| `/capture` | Universelle mobile Inbox — Quick Capture, Triage, KI-Vorschläge (Review) |
| `/projects` | Persönliche Projekte (UWE, Homelab, DnD, …) |
| `/workshop` | Werkstatt / Miniaturen / Terrain / 3D-Druck |
| `/contracts` | Verträge & Monatsausgaben (manuell, keine Bank-Anbindung) |
| `/hardware` | Homelab-Geräte, Setup-Schritte, URL-Warnungen |
| `/life-brain` | Persönliches Brain — Suche, Filter, Capture-Import |
| `/life-brain/documents/[id]` | Life-Brain-Dokument-Detail |
| `/life-brain/facts/[id]` | Life-Brain-Fakt-Detail |
| `/admin/status` | Studio Security + RTX Exposure |

### Life-Brain APIs (Studio-Auth, lokal)

| Route | Zweck |
|-------|--------|
| `/api/life-brain/search` | Stichwort-/Filter-Suche |
| `/api/life-brain/context` | Query-fokussierter Kontext für lokale Agenten (RTX only) |

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
- `packages/database/src/personal-brain-search.test.ts`
- `packages/database/src/personal-brain-privacy.test.ts`
- `packages/database/src/capture-triage-service.test.ts`
- `packages/database/src/studio-security.test.ts`
- `apps/studio/src/lib/today-dashboard.test.ts`
- `packages/ai-brain/src/router/personal-brain-privacy.test.ts`
