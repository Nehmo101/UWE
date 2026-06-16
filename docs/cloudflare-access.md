# Cloudflare Access für UWE (uweanddragons.org)

Diese Anleitung beschreibt, wie Cloudflare Access als **zusätzliche** Schutzschicht vor Studio, Admin und sensiblen APIs eingesetzt wird. UWE erzwingt Zugriffskontrolle zusätzlich serverseitig über `authorize()` und die Route Policy in `packages/auth/src/security/route-policy.ts` — Cloudflare Access ersetzt diese Guards nicht.

## Zielbild

| Bereich | Erreichbarkeit |
|---------|----------------|
| Public Player-Routen (`/`, `/worlds/*`, `/players/*`, `/share/*`, `/public-assets/*`) | **Ohne** Cloudflare Access |
| Studio / Admin / Brain / Import / AI | **Nur** mit Cloudflare Access + UWE-interner Auth |

Empfohlene E-Mail für Admin-Zugriff: `lasset610@gmail.com`

## Architektur

```txt
Internet
  ↓
Cloudflare (HTTPS, Access Policies)
  ↓
cloudflared Tunnel → localhost:3000 (Studio) / :3001 (Portal)
  ↓
UWE Middleware + authorize() (zweite Schicht)
```

## Variante A — Getrennte Access Applications (empfohlen)

### 1. Public Portal Application

- **Domain:** `uweandragons.org`
- **Path:** ausgeschlossen — nur Player-Pfade über Tunnel **ohne** Access Policy
- Oder: eigener Hostname `players.uweanddragons.org` ohne Access

Öffentliche Pfade (kein Access):

- `/`
- `/worlds` und `/worlds/*`
- `/players` und `/players/*` (Proxy-Alias)
- `/share/*`
- `/public-assets/*`
- `/api/health`
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/preview`
- `/api/share/*`
- `/api/assets/*/file`
- `/api/worlds/*/graph`

### 2. Studio / Admin Application

Erstelle in Cloudflare Zero Trust → **Access → Applications** eine Self-hosted Application:

| Feld | Wert |
|------|------|
| Application name | `UWE Studio & Admin` |
| Session Duration | z. B. 24h |
| Application domain | `uweanddragons.org` |
| Path | einer oder mehrere der folgenden Pfade |

Geschützte Pfade:

```
/studio
/studio/*
/admin
/admin/*
/api/admin
/api/admin/*
/api/import
/api/import/*
/api/brain
/api/brain/*
/api/ai
/api/ai/*
/api/search
/api/search/*
/api/command/search
/api/media/upload
/api/media/upload/*
/api/worlds/*/assets/upload
/api/backup
/api/backup/*
/api/settings
/api/export
/api/export/*
/api/mail
/api/mail/*
/api/jobs
/api/jobs/*
/api/agent-jobs
/api/agent-jobs/*
/api/debug
/api/debug/*
```

> **Hinweis:** Wenn Studio und Portal auf getrennten Ports laufen, kann alternativ `studio.uweandragons.org` komplett hinter Access liegen, während `uweandragons.org` nur das Portal bedient.

### 3. Access Policy

Policy-Name: `UWE Admin — lasset610`

| Regel | Wert |
|-------|------|
| Action | Allow |
| Include | Emails → `lasset610@gmail.com` |
| Require | (optional) MFA |

Keine weiteren Include-Regeln für diese Application.

## Variante B — Wildcard Application

Eine Application für `uweandragons.org/*` mit **Bypass**-Policies für Public-Pfade und **Allow** für Admin:

1. **Bypass Policy** (Priority 1): Paths `/worlds*`, `/players*`, `/share*`, `/public-assets*`, `/api/health`, `/api/auth/*`, `/api/share/*`, `/api/assets/*`, `/api/worlds/*/graph`
2. **Allow Policy** (Priority 2): Email `lasset610@gmail.com` für alle übrigen Pfade

Wildcard-Apps sind schwerer zu warten — Variante A ist klarer.

## Tunnel-Konfiguration (Beispiel)

`~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL-ID>
credentials-file: /path/to/<TUNNEL-ID>.json

ingress:
  - hostname: uweandragons.org
    service: http://127.0.0.1:3001
  - hostname: studio.uweandragons.org
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Bei Single-Host-Setup mit Path-Routing vor dem Tunnel kann ein lokaler Reverse Proxy Studio unter `/studio` und Portal unter `/` terminieren.

## UWE Environment

```env
PUBLIC_APP_URL=https://uweanddragons.org
TRUST_PROXY=true
CLOUDFLARE_TUNNEL=true
AUTH_REQUIRED=true
STUDIO_API_TOKEN=<starkes-zufalls-token>
STUDIO_ACCESS_ALLOWED_EMAILS=lasset610@gmail.com
```

`STUDIO_ACCESS_ALLOWED_EMAILS` wird von UWE ausgewertet, wenn Cloudflare den Header `Cf-Access-Authenticated-User-Email` mitsendet.

## Verifikation

Nach dem Setup:

1. **Public:** `curl -s https://uweanddragons.org/api/health` → HTTP 200
2. **Protected API ohne Auth:** `curl -s -o /dev/null -w "%{http_code}" https://uweanddragons.org/api/brain/run` → `401` oder `403` (oder Cloudflare Login)
3. **Mit Access-Cookie / Token:** Studio-UI und Admin-APIs erreichbar
4. **Player-Inhalt:** `/worlds/<slug>` zeigt keine `dm_only`-Seiten (UWE filtert serverseitig)

Automatisierte Tests: `pnpm --filter @uwe/auth test`

## Wichtige Regeln

- Cloudflare Access ist **Schicht 1**, UWE Middleware/Proxy ist **Schicht 2**, `authorize()` in API Routes und Server Actions ist **Schicht 3**.
- Entferne niemals `STUDIO_API_TOKEN` allein deshalb, weil Access aktiv ist.
- Der RTX-Inferenz-Endpunkt bleibt **nicht** über Cloudflare erreichbar — nur UWE im Heimnetz spricht Ollama/LM Studio an (`AI_INFERENCE_ALLOW_PUBLIC_URL=false`).
