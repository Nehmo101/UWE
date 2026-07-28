# UWE Security Review — Final Pass (2026-06-16)

> **Historisches Dokument.** Viele Punkte wurden behoben (Studio-Session-Login, Route-Policy, geschützte APIs). **Aktuelle Source of Truth:** [SECURITY.md](../../SECURITY.md), [docs/SECURITY_QA_MATRIX.md](../SECURITY_QA_MATRIX.md).

Security review before public exposure via Cloudflare. Scope: Studio, Portal, shared packages, backups, uploads, AI, secrets, headers.

---

## 1. Geprüfte Bereiche

| Bereich | Status | Details |
|---------|--------|---------|
| **Auth (Portal)** | ✅ | Session-Cookies (httpOnly, SameSite, Secure in Production), Login rate-limited, Logout löscht DB-Session + Cookies |
| **Auth (Studio)** | ✅ | Session-Login (`/login`) für `owner`/`admin`/`dm`; Setup, Passwort-Reset; plus Cloudflare Access + `STUDIO_API_TOKEN` bei Exposition |
| **Authz (Portal)** | ✅ | Rollenmatrix (`owner`/`dm`/`player`/`guest`), Asset/Page/Block-Permissions, Share-Grants |
| **Authz (Studio API)** | ✅ (nach Fix) | Alle sensiblen Routen mit `requireStudioApiAuth`; Restore mit `requireRestoreOwnerAuth` |
| **Public Leaks** | ✅ | `dm_only` serverseitig gefiltert (Portal, Suche, Graph, Export, Share) |
| **Uploads** | ✅ (nach Fix) | Magic-Bytes, MIME-Allowlist, Größenlimit, HTML/JS/SVG blockiert |
| **Import** | ✅ | Preview + `confirmed: true`, 10 MB Limit; kein Zip-Import (Textformate) |
| **Backup/Restore** | ✅ (nach Fix) | API geschützt, Restore-Owner-Token optional, Audit-Events, Zip-Slip-Schutz |
| **AI** | ✅ (nach Fix) | Routen geschützt, Rate-Limit (30/min/IP), Inference-URL-Guard, keine Secrets in Responses |
| **Secrets** | ✅ | `.env` gitignored, `.env.example` ohne echte Werte, Production-Warnungen aktiv |
| **Headers** | ✅ (nach Fix) | CSP, nosniff, HSTS (Production), kein CORS-Allow-Origin |
| **Tests** | ✅ | `pnpm lint`, `pnpm test`, `pnpm test:security`, `pnpm test:leaks` |

---

## 2. Gefundene Probleme

### Kritisch

1. **16 ungeschützte Studio-API-Routen** — DM-Suche, Graph, DnD-Generator, Asset-Dateien, Label/Print-Export, AI/Inference ohne `requireStudioApiAuth`. Bei erreichbarem Studio: vollständiger DM-Datenleck + Ressourcen-Missbrauch.
2. **Studio ohne zusätzliche Schicht bei Cloudflare-Exposition** — Session-Login allein reicht nicht; Cloudflare Access / Reverse-Proxy-Auth erforderlich.

### Hoch

3. **Uploads ohne Validierung** — Vertrauen in `file.type`, kein Größenlimit, SVG/HTML möglich.
4. **Keine Security-Headers** in Next.js (CSP, nosniff, HSTS).
5. **Kein AI-Rate-Limiting** auf Studio-Inference-Routen.
6. **Restore ohne Owner-Trennung** — Gleiche Credentials wie Backup bei API-Skripten.

### Mittel

7. **Keine Audit-Events** für erfolgreiche Backup/Restore-Jobs.
8. **Docker-Defaults** — `AUTH_SECRET=change-me-in-production`, `RUN_DB_SEED=auto` (in `.env`/Compose, nicht im Code hardcoded für Production).
9. **Rate-Limiter prozesslokal** — bei Multi-Instance Reverse-Proxy-Limit nötig.

### Niedrig

10. **Portal-Middleware nur in Production** — Dev offen (erwartet).
11. **Import/Restore ohne DB-Transaktion** — partielle Zustände bei Fehler möglich (bestehend).

---

## 3. Behobene Probleme

### Studio-API-Absicherung

`requireStudioApiAuth` ergänzt auf:

- `command/search`, `settings` (GET), `assets/[assetId]/file`
- `worlds/.../graph`, `labels/.../export`, `print-lists/.../export`
- `ai/settings`, `ai/sessions`, `ai/models`, `ai/generator`
- `dnd-generator`, `inference/health`, `inference/test-prompt`
- `import/formats`

**Öffentliche Allowlist** (bewusst ungeschützt):

- `GET /api/health` — Healthcheck
- `GET /api/spotify/callback` — OAuth-Callback

Regressionstest: `scripts/studio-route-auth.test.ts`

### Restore Owner-Guard

- `requireRestoreOwnerAuth` für `POST /api/backup/restore/execute`
- Optional `RESTORE_OWNER_TOKEN` in `.env` — Remote-Skripte brauchen Owner-Token, Studio-UI (same-origin) weiterhin ohne Extra-Token

### Upload-Härtung (`packages/assets/src/upload-policy.ts`)

- Magic-Byte-Erkennung + MIME-Allowlist
- Blockiert HTML, JS, SVG, XML
- Default 25 MB (`UWE_UPLOAD_MAX_BYTES` konfigurierbar; Legacy-Fallbacks `UPLOAD_MAX_BYTES` / `UWE_MAX_UPLOAD_BYTES`)
- Asset-Auslieferung: gefährliche MIME-Typen als `attachment`

### Security-Headers (`packages/auth/src/security-headers.ts`)

Studio + Portal `next.config.ts`:

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (Production)
- Kein `Access-Control-Allow-Origin` (same-origin default)

### AI Rate-Limiting

- `apps/studio/src/lib/studio-rate-limit.ts` — 30 Anfragen/Minute/IP auf Models, Generator, Inference

### Backup-Audit

- Activity-Log `backup_created` / `backup_restored` bei Job-Start und sync-Erfolg

### Zip-Slip-Test

- `packages/backup/src/archive.test.ts` — Pfade bleiben unter Uploads-Root

### Test-Skripte

```json
"test:security": "... studio-route-auth, auth, production-safety, visibility, upload, backup zip-slip ...",
"test:leaks": "... visibility, search, graph, asset, share, permissions ..."
```

---

## 4. Restrisiken

| Risiko | Schwere | Mitigation |
|--------|---------|------------|
| Studio ohne Session + Access | **Kritisch** bei öffentlicher URL | Cloudflare Access vor Studio; Session-Login; `STUDIO_API_TOKEN` setzen |
| Schwaches `AUTH_SECRET` in Docker-Default | **Hoch** | Starkes Secret in `.env`; Dashboard-Warnung prüfen |
| `RUN_DB_SEED=auto` in Docker | **Hoch** in Production | `RUN_DB_SEED=false` setzen |
| `player_visible` = ohne Login lesbar | **By design** | Bewusst veröffentlichen; `AUTH_REQUIRED=true` für Portal |
| `PLAYER_PREVIEW_ALLOW_DM_ONLY=true` | **Kritisch** | Nie in Production aktivieren |
| RTX/Ollama öffentliche URLs | **Kritisch** | Nur LAN/Private IPs; `AI_INFERENCE_ALLOW_PUBLIC_URL=false` |
| In-Memory Rate-Limits | **Mittel** | Cloudflare Rate-Limiting / nginx bei Multi-Instance |
| Import/Restore ohne Transaktion | **Mittel** | Preview + `confirmed: true`; Backups vor Restore |
| SQLite Concurrency | **Niedrig** | Für kleine/mittlere Deployments OK |

---

## 5. Manuelle Cloudflare Access Checkliste

Vor Go-Live auf `uwe.example` (oder ähnlich):

### Cloudflare Tunnel / DNS

- [ ] Tunnel zeigt auf Reverse-Proxy oder direkt auf Host
- [ ] **Studio-Hostname** (`studio.*` oder `:3000`) hinter Cloudflare Access — nicht öffentlich ohne Policy
- [ ] **Portal-Hostname** (`portal.*` oder `:3001`) mit gewünschter Access-Policy (Login optional für Gäste)

### Cloudflare Access Policies

- [ ] Access Application für **Studio** — nur Owner/DM-E-Mail-Domain oder Allowlist
- [ ] Access Application für **Portal** — nach Bedarf (öffentlich vs. Login-Pflicht)
- [ ] Bypass-Regeln für Healthchecks nur auf `/api/health` wenn nötig

### Environment (Production `.env`)

- [ ] `NODE_ENV=production`
- [ ] `AUTH_SECRET` — `openssl rand -base64 32`, stabil halten (Spotify-Verschlüsselung)
- [ ] `RUN_DB_SEED=false`
- [ ] `STUDIO_API_TOKEN` — starkes Random-Token für Skripte/API
- [ ] `RESTORE_OWNER_TOKEN` — separates Token für Restore-Skripte (empfohlen)
- [ ] `PUBLIC_APP_URL=https://…`
- [ ] `TRUST_PROXY=true`
- [ ] `CLOUDFLARE_TUNNEL=true`
- [ ] `SESSION_COOKIE_SECURE=true`
- [ ] `AUTH_REQUIRED=true` (wenn Portal-Login Pflicht)
- [ ] `PLAYER_PREVIEW_ALLOW_DM_ONLY=false`
- [ ] `AI_INFERENCE_ALLOW_PUBLIC_URL=false`
- [ ] RTX/Inference-URLs nur private IPs (`192.168.x.x`)

### Nach Deployment verifizieren

- [ ] `GET /api/admin/status` (Studio, eingeloggt via Access) — Security-Level „geschützt“
- [ ] Portal: `dm_only`-Seite als Gast → 404/Redirect
- [ ] Studio von extern **ohne** Access → blockiert
- [ ] `curl -H "Origin: https://evil.example" https://studio…/api/backup` → 403
- [ ] Share-Links: abgelaufen/deaktiviert → kein Zugriff
- [ ] Upload `.html` / `.svg` → abgelehnt

### Laufender Betrieb

- [ ] Regelmäßige Backups (`./data/backups`, Volume `uwe-database`)
- [ ] Aktive Share-Links prüfen
- [ ] `pnpm audit` in Dev-Umgebung
- [ ] Cloudflare Rate-Limiting für Login/AI falls nötig

---

## 6. Testergebnisse

| Command | Ergebnis |
|---------|----------|
| `pnpm lint` | ✅ Pass |
| `pnpm test` | ✅ 320+ Tests Pass |
| `pnpm test:security` | ✅ Pass (152 Tests) |
| `pnpm test:leaks` | ✅ Pass (66 Tests) |

---

## 7. Referenzen

- [SECURITY.md](../../SECURITY.md) — Security Policy
- [docs/SECURITY_SETTINGS.md](../SECURITY_SETTINGS.md) — Einstellungen
- [docs/PRODUCTION.md](../PRODUCTION.md) — Production Deployment
- Admin-Dashboard: `/admin/status` — Live-Security-Assessment
