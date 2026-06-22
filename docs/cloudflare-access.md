# Cloudflare Access für UWE (uweandragons.org)

Diese Anleitung beschreibt, wie Cloudflare Access als **zusätzliche** Schutzschicht vor Studio und Admin eingesetzt wird. UWE erzwingt Zugriffskontrolle zusätzlich serverseitig über `authorize()` und die Route Policy in `packages/auth/src/security/route-policy.ts` — Cloudflare Access ersetzt diese Guards nicht.

## Zielbild (Unified Path — empfohlen)

Ein öffentlicher Hostname, getrennte Pfade für Portal und Studio:

| Bereich | Öffentlicher Pfad | Backend | Cloudflare Access |
|---------|-------------------|---------|-------------------|
| Portal UI | `/`, `/worlds/*`, `/players/*`, `/share/*` | Portal `:3001` | **Nein** |
| Portal API | `/api/*` (Player/Share/Health) | Portal `:3001` | **Nein** |
| Studio UI | `/studio/*`, `/admin/*`, `/setup*` | Studio `:3000` | **Ja** |
| Studio API | `/studio/api/*` → intern `/api/*` | Studio `:3000` | **Ja** (über `/studio*`) |

Studio-Frontend-API-Aufrufe nutzen `studioApiUrl()` aus `apps/studio/src/lib/studio-api-url.ts` — im Unified-Path-Modus `/studio/api/...`, nicht `/api/...`.

Empfohlene E-Mail für Admin-Zugriff: `lasset610@gmail.com`

## Architektur

```txt
Internet
  ↓
Cloudflare (HTTPS, Access nur auf /studio*, /admin*, /setup*)
  ↓
cloudflared Tunnel → lokaler Reverse Proxy (Caddy/nginx)
  ↓ /                    → Portal :3001
  ↓ /api/*               → Portal :3001
  ↓ /studio/*            → Studio :3000 (Prefix wird intern gestrippt)
  ↓ /studio/api/*        → Studio :3000 /api/*
  ↓
UWE Middleware + authorize() (zweite Schicht)
```

## Reverse Proxy (Unified Path)

Vor dem Tunnel oder direkt hinter `cloudflared` einen lokalen Proxy terminieren. Beispiel **Caddy**:

```caddyfile
uweandragons.org {
    # Portal — öffentlich
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }
    handle {
        reverse_proxy 127.0.0.1:3001
    }

    # Studio API — unter /studio/api/*
    handle /studio/api/* {
        uri strip_prefix /studio
        reverse_proxy 127.0.0.1:3000
    }

    # Studio UI — unter /studio/*
    handle /studio/* {
        uri strip_prefix /studio
        reverse_proxy 127.0.0.1:3000
    }

    # Admin / Setup (ohne /studio-Prefix, falls direkt geroutet)
    handle /admin/* {
        reverse_proxy 127.0.0.1:3000
    }
    handle /setup* {
        reverse_proxy 127.0.0.1:3000
    }
}
```

Beispiel **nginx** (vereinfacht):

```nginx
# Portal
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Studio API: /studio/api/* → Studio /api/*
location /studio/api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Studio UI: /studio/* → Studio /*
location /studio/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /admin/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Tunnel zeigt dann nur auf den Proxy-Port (z. B. `:8080`), nicht direkt auf `:3000`/`:3001`.

## Cloudflare Access Policies

### Öffentlich (kein Access)

- `/`
- `/worlds` und `/worlds/*`
- `/players` und `/players/*`
- `/share/*`
- `/public-assets/*`
- `/api/health`, `/api/health/*`
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/preview` (Portal)
- `/api/share/*`
- `/api/assets/*/file`
- `/api/worlds/*/graph`

**Wichtig:** `/api/*` auf Root-Ebene gehört zum **Portal** — kein Cloudflare Access darauf legen.

### Geschützt (Access erforderlich)

Nur UI- und Studio-Pfadpräfixe — **keine** einzelnen `/api/admin`-Einträge mehr nötig:

```
/studio
/studio/*
/admin
/admin/*
/setup
/setup/*
```

`/studio/api/*` ist durch `/studio/*` abgedeckt.

### Access Policy

Policy-Name: `UWE Admin — lasset610`

| Regel | Wert |
|-------|------|
| Action | Allow |
| Include | Emails → `lasset610@gmail.com` |
| Require | (optional) MFA |

## Variante — Getrennte Hostnames

Alternativ zwei Tunnel-Hostnames (ohne Path-Routing):

```yaml
ingress:
  - hostname: uweandragons.org
    service: http://127.0.0.1:3001
  - hostname: studio.uweandragons.org
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Dann Cloudflare Access auf `studio.uweandragons.org/*`, Portal-Host ohne Access. Studio-API bleibt `/api/*` auf dem Studio-Host; setze `NEXT_PUBLIC_STUDIO_URL=https://studio.uweandragons.org`.

## Tunnel-Konfiguration (Unified Path)

```yaml
tunnel: <TUNNEL-ID>
credentials-file: /path/to/<TUNNEL-ID>.json

ingress:
  - hostname: uweandragons.org
    service: http://127.0.0.1:8080   # lokaler Reverse Proxy (siehe oben)
  - service: http_status:404
```

## UWE Environment

```env
PUBLIC_APP_URL=https://uweandragons.org
STUDIO_PATH=/studio
PORTAL_PATH=/
TRUST_PROXY=true
CLOUDFLARE_TUNNEL=true
CLOUDFLARE_ACCESS_ENABLED=true
AUTH_REQUIRED=true
STUDIO_API_TOKEN=<starkes-zufalls-token>
STUDIO_ACCESS_ALLOWED_EMAILS=lasset610@gmail.com

# Browser: Studio fetch() → /studio/api/...
NEXT_PUBLIC_STUDIO_PATH=/studio
# Optional — absolute API-Origin statt relativer Pfade:
# NEXT_PUBLIC_STUDIO_API_ORIGIN=https://uweandragons.org/studio
```

Ohne `NEXT_PUBLIC_STUDIO_URL` + `NEXT_PUBLIC_PORTAL_URL` leitet UWE Studio-API-URLs aus `PUBLIC_APP_URL` + `STUDIO_PATH` ab.

`STUDIO_ACCESS_ALLOWED_EMAILS` wird von UWE ausgewertet, wenn Cloudflare den Header `Cf-Access-Authenticated-User-Email` mitsendet. **Pflicht in Produktion** — ohne gesetzte Variable akzeptiert UWE keinen Cloudflare-Access-Header.

## Verifikation

Nach dem Setup:

1. **Portal public:** `curl -s https://uweandragons.org/api/health/public` → HTTP 200
2. **Studio API ohne Auth:** `curl -s -o /dev/null -w "%{http_code}" https://uweandragons.org/studio/api/brain/run` → `401`/`403` oder Cloudflare Login
3. **Portal-API bleibt ohne Access:** `curl -s https://uweandragons.org/api/health` → HTTP 200 (kein Access-Redirect)
4. **Mit Access-Cookie / Token:** Studio-UI unter `/studio` und `/studio/api/*` erreichbar
5. **Player-Inhalt:** `/worlds/<slug>` zeigt keine `dm_only`-Seiten (UWE filtert serverseitig)

Automatisierte Tests: `pnpm --filter @uwe/auth test`

## Wichtige Regeln

- Cloudflare Access ist **Schicht 1**, Reverse Proxy + UWE Middleware ist **Schicht 2**, `authorize()` in API Routes und Server Actions ist **Schicht 3**.
- **Kein** Cloudflare Access auf `/api/*` (Portal-API) — Studio-API läuft unter `/studio/api/*`.
- Entferne niemals `STUDIO_API_TOKEN` allein deshalb, weil Access aktiv ist.
- Der RTX-Inferenz-Endpunkt bleibt **nicht** über Cloudflare erreichbar (`AI_INFERENCE_ALLOW_PUBLIC_URL=false`).
