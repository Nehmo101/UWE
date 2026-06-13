# P13 — Smoke-Tests und QA-Checkliste

Manuelle und automatisierte Checks für den produktiven Zwei-Maschinen-Setup (alter Laptop + RTX + Cloudflare).

Automatisierte Tests: `pnpm test` (siehe Abschnitt **Automatisierte Abdeckung**).

## Alter Laptop — Basis

1. UWE starten (Steuerung oder `pnpm build` + Start).
2. `GET /api/health` → `status: ok`, Database und Storage `ok`.
3. Studio-Login funktioniert (`AUTH_REQUIRED=true`).
4. Daten bleiben nach Neustart erhalten (`UWE_DATA_DIR` / `%LOCALAPPDATA%\UWE\data`).

Details: [docs/PRODUCTION.md](../PRODUCTION.md) — Abschnitt „Smoke-Checks nach Start“.

## Cloudflare / Proxy / Cookies

1. `PUBLIC_APP_URL=https://uweandragons.org` gesetzt.
2. `TRUST_PROXY=true` und `CLOUDFLARE_TUNNEL=true` hinter Tunnel.
3. `SESSION_COOKIE_SECURE=true` in Production.
4. Login über öffentliche URL funktioniert; Session bleibt nach Reload.
5. Tunnel zeigt nur auf UWE (`localhost:3000`) — **nicht** auf Ollama/RTX.

Details: [docs/PRODUCTION.md](../PRODUCTION.md) — Abschnitt „Cloudflare Tunnel“.

## Mail (SMTP)

1. `MAIL_ENABLED=true`, `SMTP_HOST`, `MAIL_FROM` gesetzt; `SMTP_PASSWORD` nur in `.env`.
2. Studio → Einstellungen / Mail: Status zeigt „konfiguriert“, **kein** Passwort im UI.
3. Testmail manuell senden (kein Auto-Send aus Compose-Flows).
4. Bei falschem SMTP: Fehlermeldung sichtbar, Mail-Log `failed`, UWE bleibt nutzbar.
5. Session-Recap-Mail an Spieler enthält nur `summaryPlayer`, nicht DM-Zusammenfassung.

Mock-Modus für Tests: `MAIL_USE_MOCK=true` (kein echter Versand).

## RTX Inference (Ollama / LM Studio)

1. `AI_INFERENCE_BASE_URL` zeigt auf Heimnetz-IP (z. B. `http://192.168.178.50:11434`).
2. `AI_INFERENCE_ALLOW_PUBLIC_URL=false`.
3. Admin-Status `/admin/status` oder `/api/admin/status`: RTX `online` wenn Ollama läuft.
4. Testprompt aus Studio oder Inference-Health erfolgreich.
5. RTX abschalten: Status `offline`, Studio crasht nicht, AI-Aktionen zeigen Fehler ohne App-Absturz.
6. Timeout: bei hängendem Modell klare Timeout-Meldung (ENV `AI_INFERENCE_TIMEOUT_SECONDS`).

## Brain / Context / Sichtbarkeit

1. Brain-Einträge mit `dm_only` erscheinen nicht in Player-Preview.
2. Context Builder für Spieler-Tasks filtert `dm_only` Brain-Wissen.
3. AI-Runs speichern Prompt, Kontext-Snapshot und Ergebnis in der Run-History.
4. Review/Apply: Vorschlag wird nicht blind übernommen — explizites Apply nötig.

## Admin Health Dashboard

1. Studio → `/admin/status` (Auth erforderlich).
2. Sichtbar: System, Database, Storage, Mail, Brain, RTX Inference, Jobs, Auth.
3. Keine Secrets in der JSON-Antwort (`SMTP_PASSWORD`, `AUTH_SECRET`, API Keys).

## Backup / Restore

1. Backup erstellen: `pnpm backup` oder Steuerung → Backup.
2. Restore nur mit UWE gestoppt; vor Restore automatisches Sicherungs-Backup.
3. Brain-Daten, Mail-Logs und Welten sind im Backup enthalten.

Details: [docs/backup-restore.md](../backup-restore.md), [docs/BACKUP.md](../BACKUP.md).

## Automatisierte Abdeckung (P13)

| Bereich | Testdateien |
|---------|-------------|
| Secrets nicht im Frontend | `settings-service.test.ts`, `admin-status.test.ts`, `system-status.test.ts`, `mail-service.test.ts` |
| SMTP-Fehler / Redaction | `mail-service.test.ts`, `transport.test.ts`, `config.test.ts` |
| Mail dm_only an Spieler | `compose.test.ts`, `mail-service.test.ts` |
| RTX offline / Timeout | `inference.test.ts` (Ollama offline, timeout, `getInferenceStatus`) |
| MockProvider | `inference.test.ts`, `ai-brain.test.ts` |
| Context Sichtbarkeit | `context-builder.test.ts`, `brain-store.test.ts` |
| Player Preview dm_only | `visibility-security.test.ts`, `page-service.test.ts`, `share-link.test.ts` |
| AI Run History | `ai-run.test.ts` |
| Review/Apply | `ai-review.test.ts` |
| Backup ohne Secrets | `backup.test.ts` |

## Bekannte Restfehler / Grenzen

- Windows: Pakete mit Glob `'src/**/*.test.ts'` nutzen `scripts/run-node-tests.mjs` (mail, database).
- Echter SMTP- und RTX-End-to-End-Test erfordert laufende Infrastruktur; Unit-Tests mocken Transport/Fetch.
- `MAIL_USE_MOCK=true` und `AI_USE_MOCK=true` für lokale Tests ohne externe Dienste.
- Embeddings semantic-search Test kann unter Turbo-Parallelität flaky sein.
- **Typecheck:** `@uwe/studio` Modulpfade in zwei API-Routes (vorbestehend).
- **Lint:** 7 unused-vars Fehler (vorbestehend).
