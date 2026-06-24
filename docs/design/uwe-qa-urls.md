# UWE QA URL-Checkliste (Teil 7)

Stand: Juni 2026 · Produktions-Host: **uweandragons.org**

Manuelle Browser-QA nach UI-Refresh und IA-Konsolidierung. Alle Studio-Routen bleiben erreichbar; einige leiten auf neue Hub-Seiten um.

## Basis-URLs

| Umgebung | Portal | Studio (Unified Path) | Studio (Subdomain) |
|----------|--------|------------------------|---------------------|
| Produktion | `https://uweandragons.org` | `https://uweandragons.org/studio` | `https://studio.uweandragons.org` |
| Lokal | `http://localhost:3001` | `http://localhost:3000` | — |

Setze `PUBLIC_APP_URL=https://uweandragons.org` und ggf. `NEXT_PUBLIC_STUDIO_URL` gemäß `docs/cloudflare-access.md`.

---

## Health & Auth (Smoke)

| # | URL | Erwartung |
|---|-----|-----------|
| 1 | `https://uweandragons.org/api/health/public` | HTTP 200, `{ ok: true }` |
| 2 | `https://uweandragons.org/api/health` | HTTP 200 (Portal, kein Access-Redirect) |
| 3 | `https://uweandragons.org/studio/api/health` | HTTP 200 nach Studio-Login / Access |
| 4 | `https://uweandragons.org/studio/login` | Login-Formular |
| 5 | `https://uweandragons.org/studio/api/brain/run` (ohne Auth) | 401/403 oder Cloudflare Access |

Demo-Login (lokal/Seed): `dm@uwe.local` / `uwe-dev`

---

## Studio — IA-Sektionen (Sidebar)

Nach Login: Sidebar zeigt **Heute · Welten · Leben · Werkstatt · Wissen · Medien · KI · System · Admin**.

### Heute

| # | Pfad | Label / Check |
|---|------|----------------|
| 10 | `/today` | Primary Home, Daily Cockpit lädt |
| 11 | `/studio` | Redirect → `/today` |

### Welten

| # | Pfad | Check |
|---|------|-------|
| 20 | `/worlds` | Weltliste |
| 21 | `/search` | Globale Suche |
| 22 | `/templates` | Template-Übersicht |
| 23 | `/worlds/terra/dashboard` | Demo-Welt Terra (nach Seed) |
| 24 | `/worlds/terra` | Seitenliste |
| 25 | `/worlds/terra/sessions` | Sessions |
| 26 | `/worlds/terra/inspector` | Kanon & Leaks |
| 27 | `/worlds/terra/brain` | Welt-Brain |

### Leben

| # | Pfad | Check |
|---|------|-------|
| 30 | `/capture` | Capture-Inbox |
| 31 | `/projects` | Projekte |
| 32 | `/contracts` | Verträge |
| 33 | `/hardware` | Hardware/Homelab + Banner „→ Zum System-Hub“ |

### Werkstatt

| # | Pfad | Check |
|---|------|-------|
| 40 | `/workshop` | Werkstatt-Übersicht |

### Wissen

| # | Pfad | Check |
|---|------|-------|
| 50 | `/life-brain` | Life Brain (Studio-only) |
| 51 | `/brain` | Globaler Brain Store |

### Medien

| # | Pfad | Check |
|---|------|-------|
| 60 | `/image-studio` | Image Studio |
| 61 | `/mail` | Mail Center |
| 62 | `/calendar` | Kalender |

### KI

| # | Pfad | Check |
|---|------|-------|
| 70 | `/ai` | Unified KI-Chat |
| 71 | `/admin/ai-prompt` | Redirect → `/ai` (Query `?world=` & `?page=` erhalten) |
| 72 | `/admin/ai-prompt?world=terra&page=example` | Redirect → `/ai?world=terra&page=example` |
| 73 | `/admin/reviews` | AI Reviews |
| 74 | `/admin/agent-jobs` | Agent Jobs |

### System

| # | Pfad | Check |
|---|------|-------|
| 80 | `/system` | System-Hub, Tab **Übersicht** |
| 81 | `/system?tab=homelab` | Tab Homelab |
| 82 | `/system?tab=diagnose` | Tab Diagnose |
| 83 | `/system?tab=cloudflare` | Tab Cloudflare |
| 84 | `/admin/status` | Legacy Status + Banner „→ Zum System-Hub“ |
| 85 | `/jobs` | Job-Queue |
| 86 | `/backup` | Backup & Restore |
| 87 | `/settings` | Einstellungen |
| 88 | `/settings?tab=status` | Link zum System-Hub |

### Admin

| # | Pfad | Check |
|---|------|-------|
| 90 | `/admin` | Admin-Übersicht |
| 91 | `/admin/users` | Benutzer |
| 92 | `/admin/security` | Security Dashboard |
| 93 | `/admin/audit-log` | Audit Log |
| 94 | `/admin/tags` | Tags |
| 95 | `/admin/cookbook` | Cookbook |

### Legacy / weiterhin erreichbar

| # | Pfad | Check |
|---|------|-------|
| 100 | `/setup` | Initial Setup |
| 101 | `/admin/ai-gateway` | KI-Gateway |
| 102 | `/admin/api-tokens` | API Tokens |
| 103 | `/admin/webhooks` | Webhooks |
| 104 | `/admin/mail` | Mail Portal Admin |
| 105 | `/account/password` | Passwort ändern |
| 106 | `/account/security` | 2FA |

---

## Portal (Spieler)

| # | URL | Check |
|---|-----|-------|
| 200 | `https://uweandragons.org/` | Landing / Gast-Wiki |
| 201 | `https://uweandragons.org/worlds` | Öffentliche Welten |
| 202 | `https://uweandragons.org/worlds/terra` | Gast-Wiki Terra |
| 203 | `https://uweandragons.org/login` | Spieler-Login |
| 204 | `https://uweandragons.org/auth/worlds` | Meine Welten (eingeloggt) |
| 205 | `https://uweandragons.org/auth/worlds/terra` | Spieler-Dashboard |

Kein `dm_only`-Leak in Portal-HTML oder `/api/*`-Antworten (siehe `pnpm test:security`).

---

## Mobile Bottom Nav (Studio, 390 px)

| Tab | Label | Ziel |
|-----|-------|------|
| 1 | Heute | `/today` |
| 2 | Leben | `/capture` |
| 3 | Welten | `/worlds` |
| 4 | KI | `/ai` |
| 5 | Mehr | Sidebar öffnen |

---

## Themes (visuell)

Mindestens in **Parchment OS (hell)** und **uwe-default (dunkel)** prüfen:

- [ ] `/today` — keine dunklen Fremdkörper
- [ ] `/worlds/terra/[session-page]` — Graph/Relations kompakt
- [ ] `/ai` — ruhiger Offline-Hinweis statt harter Fehlerbox
- [ ] `/system` — Tabs lesbar, Status-Karten korrekt gefärbt
- [ ] Portal-Weltseite — konsistente Badges

---

## Cloudflare / Selfhosting

Siehe auch `docs/cloudflare-access.md` und Tab **Cloudflare** im System-Hub.

| Check | Befehl / Ort |
|-------|----------------|
| Tunnel aktiv | `/system?tab=cloudflare` → „Tunnel aktiv“ |
| TRUST_PROXY | Env + Studio Security Karte |
| RTX nicht öffentlich | RTX Exposure Karte = „Privates Netz“ |
| Studio hinter Access | `/studio/*` erfordert Cloudflare Access |

---

## Automatisierung

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/studio test    # studio-navigation.test.ts, mobile-nav.test.ts
pnpm quality                      # vor PR
```

---

## Abnahme

- [ ] Alle Sidebar-Sektionen sichtbar und auf Deutsch
- [ ] `/studio` → `/today`, `/admin/ai-prompt` → `/ai`
- [ ] System-Hub-Tabs funktional
- [ ] Banner auf `/hardware` und `/admin/status`
- [ ] Keine Regression bei Welt-Navigation und Command Palette
