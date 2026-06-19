# UWE Daily Admin OS

Lasses privates Admin-Cockpit in UWE Studio — neben DnD-Welten für Projekte, Capture, Verträge, Hardware und persönliches Life-Brain.

## Routen

| Route | Zweck |
|-------|--------|
| `/today` | Daily Cockpit — System-Ampel, DnD-Favorit, Life-Admin-Karten |
| `/capture` | Schnell-Eingang (Inbox) — funktioniert ohne RTX |
| `/projects` | Persönliche Projekte (UWE, Homelab, DnD, …) |
| `/workshop` | Werkstatt / Miniaturen / Terrain / 3D-Druck |
| `/contracts` | Verträge & Monatsausgaben (manuell, keine Bank-Anbindung) |
| `/hardware` | Homelab-Kontrollzentrum — Geräte, Service-Status, Runbooks, Security, Fehlerhistorie |
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
- `packages/database/src/hardware-utils.test.ts`
- `packages/database/src/homelab-cockpit.test.ts`
- `packages/database/src/studio-security.test.ts`
- `apps/studio/src/lib/today-dashboard.test.ts`
- `packages/ai-brain/src/router/personal-brain-privacy.test.ts`

## Homelab Cockpit (`/hardware`)

- **Service-Status:** UWE Studio, Portal, DB, Cloudflare Tunnel, RTX Agent, Ollama, Backup
- **Runbooks:** Nach Neustart, UWE starten, Logs/SSH/Cloudflare/DB/RTX prüfen
- **Security Checklist:** SSH, User, Cloudflare Access, RTX nicht öffentlich, Secrets, Firewall
- **Fehlerhistorie:** pro Gerät in `metadata.errorHistory` — aggregiert auf der Hardware-Seite
- **Today:** System-Ampel mit live DB/Backup/Cloudflare; kritische Homelab-Warnungen verlinken auf `/hardware`

RTX-Agent und Ollama dürfen **niemals** öffentlich exponiert werden — URL-Warnungen auf Gerätekarten und in `/today`.
