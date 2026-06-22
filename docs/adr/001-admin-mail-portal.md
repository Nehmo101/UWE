# ADR 001: Admin Mail Portal

## Status

Accepted — 2026-06-22

## Kontext

UWE hat ein **Mail Center** (`/mail`) für SMTP-Diagnose, Kampagnen-Templates und ausgehende Mails. Für den Admin fehlt ein **Mail Portal**: mehrere Postfächer, Inbox lesen/suchen, priorisieren, antworten, KI-Vorschläge — alles Studio-only, ohne Portal-Leak.

Vorhandene Bausteine:

- `packages/mail` — SMTP-Transport, IMAP-Sync (`imapflow`), Redaction
- `packages/database` — `MailAccount`, `MailInboxMessage`, `MailDraft`, verschlüsselte Credentials
- Studio APIs unter `/api/mail/*` (Session-Guard, nicht Admin-spezifisch)

## Entscheidung

### 1. Admin-Modul unter `/admin/mail`

- Neuer Bereich **Admin → Mail Portal** (`/admin/mail`), nicht das bestehende Mail Center ersetzen.
- Mail Center bleibt für Welt-/Template-Versand; Mail Portal für persönliche Admin-Postfächer.

### 2. APIs unter `/api/admin/mail/*`

- `requireAdminApiAuth` + Session/CSRF wie andere Admin-Routen.
- Keine Secrets in Responses; Audit-Log für lesen/senden/sync/priorisieren.

### 3. Datenmodell — Erweiterung statt Parallelwelt

Bestehende Tabellen erweitern, neue ergänzen:

| Tabelle | Zweck |
|---------|--------|
| `mail_accounts` (+ Felder) | `provider_preset`, `imap_mailbox`, Sync-Health |
| `mail_folders` | IMAP-Ordner pro Account |
| `mail_inbox_messages` (+ Felder) | `folder_id`, `in_reply_to`, Suche |
| `mail_attachments` | Lazy-Metadaten, kein Blind-Download |
| `mail_priority_scores` | priority, category, confidence, explanation, extracted_actions |
| `mail_ai_actions` | summarize/reply-draft Audit |
| `mail_audit_log` | Admin-Mail-Aktionen |

### 4. Priorisierung: Regeln + KI

1. **Regelbasierte Signale** (VIP-Absender, Schlüsselwörter, Newsletter-Heuristik, PDF-Anhang-Hinweis).
2. **KI-Klassifizierung** ergänzt, überschreibt Regeln nicht blind (höhere Confidence gewinnt nur bei klarem Signal).
3. Ergebnis persistiert in `mail_priority_scores`.

### 5. KI-Funktionen

- Zusammenfassung und Antwortentwurf über `@uwe/ai-brain` `generateText` (mit Mock-Fallback).
- E-Mail-HTML wird vor KI-Verarbeitung zu Plaintext gestrippt (`@uwe/mail/sanitize-html`).
- Optional PII-Redaction vorbereitet via bestehende `redactSecrets`.
- **Kein Auto-Send** — Entwurf mit `pending_review`, Senden nur nach expliziter Bestätigung.

### 6. Sync

- Manueller Sync-Button + optionaler `mail_sync` Job (bestehend).
- IMAP UID-Dedupe über `@@unique([accountId, imapUid])`.
- Attachments: Metadaten beim Sync, Inhalt lazy.

### 7. Sicherheit

- Credentials: `encryptSecret` / `decryptSecret` (bestehend).
- Admin-only (`ADMIN_ACCESS_ROLES`).
- Rate Limits auf Mutationen.

## Konsequenzen

- Migration `20260622140000_mail_portal` erforderlich.
- PostgreSQL-Schema parallel pflegen (`schema.postgresql.prisma`).
- Tests für Priorisierung und API-Auth-Smoke.
- Später: User-Scope via `owner_id` auf Accounts (Feld existiert).

## Alternativen verworfen

- **Odysseus-Code übernehmen:** zu anderer Architektur; nur Produktideen (getrennte Scopes, Diagnose-UI).
- **Mail Center erweitern:** vermischt Kampagnen-Mail mit persönlicher Inbox; Admin-Navigation unklar.
