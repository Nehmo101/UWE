# Security Settings — Integrationen

Sicherheitsrichtlinien für neue UWE-Integrationen (Image Studio, Kalender, DnD API, Agent Jobs).

## Grundsätze

1. **Brain/Wissen bleibt lokal** — keine Weltdaten an Cloud-KI unless explizit im User-Prompt (Image Studio: nur Bild-Prompt).
2. **Secrets nur serverseitig** — ENV, nie Frontend, nie API-Response.
3. **Admin-only** — Studio erfordert Session-Login (`owner`/`admin`/`dm`) plus optional `STUDIO_API_TOKEN` / Cloudflare Access bei öffentlicher Exposition.
4. **Deaktivierbar** — jedes Feature per ENV abschaltbar.
5. **Kein Auto-Merge** — Agent Jobs erstellen Draft-PRs only.

## ENV-Secrets (never expose)

| Secret | Feature |
|--------|---------|
| `RTX_SERVICE_TOKEN` | Direkter RTX Worker / Image-Pfad |
| `CLOUD_AI_API_KEY` / `OPENAI_API_KEY` | Cloud Image/Chat |
| `CALDAV_PASSWORD` | Kalender CalDAV |
| `GITHUB_TOKEN` / `AGENT_JOBS_GITHUB_TOKEN` | Agent Jobs |
| `CURSOR_CLOUD_API_KEY` | Cursor Cloud |
| `STUDIO_API_TOKEN` | API-Schutz |

## Feature-Matrix

| Feature | Local-first | Cloud optional | Daten an Cloud |
|---------|-------------|----------------|----------------|
| Image Studio | RTX Worker / Connector | DALL-E wenn `ALLOW_CLOUD` | Nur Prompt |
| Kalender | SQLite | iCal fetch only | Feed-URLs (kein Brain) |
| DnD API | Cache SQLite | Open5e/SRD public API | Suche-Query only |
| Agent Jobs | GitHub Actions | Cursor Cloud | Dev-Prompt only |

## UI

- Einstellungen → **Integrationen** — Status ohne Secrets
- `/admin/status` — RTX/Cloud Ampel (bestehend)

## Integration Smoke Tests

`scripts/integration-smoke.test.ts` prüft:
- Neue Routes existieren
- Keine Secrets in Client-Code
- Dokumentation vorhanden

## Empfehlungen Production

```env
IMAGE_STUDIO_ALLOW_CLOUD=false
AGENT_JOBS_AUTO_MERGE=false
AGENT_JOBS_ENABLED=true  # nur wenn GitHub Token gesetzt
STUDIO_API_TOKEN=<strong-random>
SESSION_COOKIE_SECURE=true
AI_LOCAL_ONLY=true  # für Brain — Image Studio separat steuerbar
```

## Audit

Siehe `docs/ARCHITECTURE.md` für vollständige Codebase-Analyse.
