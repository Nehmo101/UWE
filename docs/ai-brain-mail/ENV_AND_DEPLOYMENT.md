# ENV und Deployment: Alter Laptop, Cloudflare, RTX-Rechner

## Rollen

```txt
Alter Laptop
= UWE Host, Datenbank, Brain-Wissen, Mail, Cloudflare Tunnel

RTX-Rechner
= nur LLM-/Embedding-Inferenz, keine dauerhafte UWE-Datenhaltung

Cloudflare
= Domain, HTTPS, Tunnel, optional Access
```

## Empfohlene Netzstruktur

```txt
Internet
  ↓
Cloudflare Tunnel
  ↓
Alter Laptop: UWE
  ↓ internes Heimnetz
RTX-Rechner: Ollama/LM Studio
```

Der RTX-Rechner darf nicht direkt öffentlich erreichbar sein.

## ENV-Konzept

### Public App / Proxy

```env
PUBLIC_APP_URL=https://uweanddragons.org
TRUST_PROXY=true
CLOUDFLARE_TUNNEL=true
AUTH_REQUIRED=true
NODE_ENV=production
```

### Storage

```env
UWE_DATA_DIR=/var/lib/uwe
UWE_UPLOADS_DIR=/var/lib/uwe/uploads
UWE_BACKUP_DIR=/var/lib/uwe/backups
UWE_EXPORT_DIR=/var/lib/uwe/exports
```

Windows-Beispiel:

```env
UWE_DATA_DIR=C:\UWE\data
UWE_UPLOADS_DIR=C:\UWE\uploads
UWE_BACKUP_DIR=C:\UWE\backups
UWE_EXPORT_DIR=C:\UWE\exports
```

### Auth

```env
AUTH_REQUIRED=true
AUTH_SECRET=change-me-long-random-secret
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax
```

### Player Preview

```env
PLAYER_PREVIEW_PUBLIC=false
PLAYER_PREVIEW_REQUIRE_TOKEN=true
PLAYER_PREVIEW_ALLOW_DM_ONLY=false
```

### Mail

```env
MAIL_ENABLED=true
MAIL_FROM="UWE <uwe@uweanddragons.org>"
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=change-me
SMTP_PASSWORD=change-me
MAIL_LOG_BODY=false
```

Regeln:

- SMTP_PASSWORD nie ins Frontend geben.
- Mail-Logs sollen keine Secrets enthalten.
- `MAIL_LOG_BODY=false` ist für Production sicherer.

### Brain Knowledge Store

```env
BRAIN_ENABLED=true
BRAIN_STORAGE=database
BRAIN_ALLOW_DM_ONLY_CONTEXT=true
BRAIN_DEFAULT_VISIBILITY=dm_only
BRAIN_MAX_CONTEXT_CHARS=24000
BRAIN_REQUIRE_REVIEW_BEFORE_APPLY=true
```

### RTX Inference

```env
AI_INFERENCE_ENABLED=true
AI_INFERENCE_PROVIDER=ollama
AI_INFERENCE_BASE_URL=http://192.168.178.50:11434
AI_INFERENCE_DEFAULT_MODEL=qwen2.5-coder:7b
AI_INFERENCE_TIMEOUT_SECONDS=120
AI_INFERENCE_ALLOW_PUBLIC_URL=false
```

LM Studio/OpenAI-compatible Beispiel:

```env
AI_INFERENCE_PROVIDER=openai-compatible
AI_INFERENCE_BASE_URL=http://192.168.178.50:1234/v1
AI_INFERENCE_DEFAULT_MODEL=local-model
AI_INFERENCE_API_KEY=not-needed-or-local-key
```

### Embeddings

```env
BRAIN_EMBEDDINGS_ENABLED=true
BRAIN_EMBEDDING_PROVIDER=ollama
BRAIN_EMBEDDING_MODEL=nomic-embed-text
BRAIN_EMBEDDING_BASE_URL=http://192.168.178.50:11434
BRAIN_EMBEDDINGS_STORE=uwe-database
```

Regel:

- RTX darf Embeddings berechnen.
- UWE speichert Vektoren dauerhaft.
- RTX speichert keine UWE-Daten dauerhaft.

## Healthchecks

UWE sollte Healthchecks haben für:

```txt
/app health
/database health
/storage health
/auth config
/mail smtp test
/brain store health
/inference health
/embedding health
/cloudflare/proxy awareness
```

## Cloudflare Tunnel Hinweise

Empfohlene Variante:

```txt
cloudflared tunnel → http://localhost:<uwe-port>
```

Cloudflare leitet nur an UWE weiter. Nicht an Ollama, LM Studio oder andere interne Dienste.

Zusätzlich sinnvoll:

- Cloudflare Access für Studio/Admin
- normale UWE-Auth trotzdem aktiv lassen
- HTTPS-only
- keine Router-Portfreigabe nötig

## RTX-Rechner Setup

### Ollama

Der RTX-Rechner sollte Ollama nur im Heimnetz bereitstellen.

Beispiel Zieladresse:

```txt
http://192.168.178.50:11434
```

Firewall-Regel:

- Zugriff nur aus Heimnetz erlauben
- optional nur alter Laptop erlaubt
- kein Zugriff aus Internet

### LM Studio

LM Studio Server sollte ebenfalls nur im Heimnetz lauschen.

Beispiel Zieladresse:

```txt
http://192.168.178.50:1234/v1
```

## Offline-Verhalten

### RTX offline

UWE muss weiter funktionieren:

- Studio nutzbar
- Mail nutzbar
- Player Preview nutzbar
- Brain-Wissen lesbar
- AI-Aktionen zeigen offline
- Jobs kontrolliert failed/pending

### SMTP offline/falsch

UWE muss weiter funktionieren:

- Testmail zeigt Fehler
- Mail-Jobs schlagen kontrolliert fehl
- keine stillen Fehler

### Cloudflare offline

UWE sollte lokal erreichbar bleiben.

## Backup und Restore

UWE-Daten (Welten, Brain, Mail-Logs, Uploads) liegen auf dem alten Laptop unter `UWE_DATA_DIR` bzw. `%LOCALAPPDATA%\UWE\data`.

| Aktion | Befehl / Ort |
|--------|------------|
| Backup erstellen | `pnpm backup` oder UWE Steuerung → Backup |
| Restore | UWE stoppen → `pnpm restore` oder Steuerung |
| Manuelle Anleitung | [docs/backup-restore.md](../backup-restore.md) |
| Technische Details | [docs/BACKUP.md](../BACKUP.md) |

Regeln:

- Secrets (`SMTP_PASSWORD`, `AUTH_SECRET`, API Keys) werden nicht in Backup-Bundles exportiert.
- Vor Restore wird automatisch ein Sicherungs-Backup erstellt.
- RTX-Rechner enthält keine dauerhaften UWE-Daten — Restore betrifft nur den Laptop-Host.

## Smoke-Tests und QA

Vollständige Checkliste (manuell + automatisierte Test-Matrix): [SMOKE_TESTS.md](SMOKE_TESTS.md).

Produktions-Smoke-Checks: [docs/PRODUCTION.md](../PRODUCTION.md).

## Sicherheitscheckliste

- [ ] Studio/Auth aktiv
- [ ] Player Preview leakt keine DM-only Inhalte
- [ ] SMTP Secrets nicht im Frontend
- [ ] AI Provider API Keys nicht im Frontend
- [ ] RTX Endpoint nicht öffentlich
- [ ] Cloudflare zeigt nur auf UWE
- [ ] Brain Context Builder respektiert Sichtbarkeit
- [ ] AI Apply nur nach Review
- [ ] Backups funktionieren
- [ ] Health Dashboard zeigt Mail/Brain/RTX Status
