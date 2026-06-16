# Backup, Export & Restore — Architektur

Stand: v0.1.x. Sicheres Backup/Restore für UWE-Daten.

## Sicherheitsmodell

| Aktion | OWNER | ADMIN (dm) | PLAYER |
|--------|-------|------------|--------|
| Backup erstellen | ✅ | ✅ | ❌ |
| Backup herunterladen | ✅ | ✅ | ❌ |
| Restore-Vorschau | ✅ | ❌ | ❌ |
| Restore ausführen | ✅ | ❌ | ❌ |

Studio-API-Routen sind zusätzlich durch CSRF-Schutz und optional `STUDIO_API_TOKEN` abgesichert.
Die Rolle wird über Portal-Session oder den Header `X-UWE-Actor-Role` aufgelöst.

## Was ein vollständiges Backup enthält

- **Datenbank-Inhalte**: Worlds, Campaigns, Pages, ContentBlocks, Assets (Metadaten), Sessions, Labels, Soundboard, Mitgliedschaften
- **Medien**: Asset-Dateien im ZIP unter `assets/`
- **Settings**: SystemSettings (sanitized, keine Secrets) — nur bei Vollbackup
- **Nicht enthalten**: Passwort-Hashes, Session-Tokens, API-Keys, `.env`-Secrets

## Sicherheitsfeatures

- **Sanitization** — `sanitizeBackupData` / `findSecretIssuesInJson` blockieren Secrets hart
- **Zip-Slip-Schutz** — `assertSafeZipEntry` validiert alle ZIP-Einträge vor Extraktion
- **Format-Validierung** — `validateBackupBundle` prüft Manifest und Datenstruktur
- **Atomares Schreiben** — Backups werden über Temp-Datei + Rename geschrieben
- **Verschlüsselung** — optional per Passwort oder `UWE_BACKUP_ENCRYPTION_KEY` (AES-256-GCM)
- **Retention** — konfigurierbar: letzte 7/14/30 Backups (`settings.backup.retentionCount`)
- **Pre-Restore Safety Copy** — automatisches Vollbackup vor jedem Restore (`pre-restore-*.zip`)
- **Audit Log** — `backup_created` / `backup_restored` Ereignisse
- **Keine öffentlichen URLs** — Download nur über authentifizierte API (`/api/backup/[id]/download`)

## API-Endpunkte

| Route | Methode | Auth |
|-------|---------|------|
| `/api/backup` | GET | list (OWNER/ADMIN) |
| `/api/backup?permissions=1` | GET | Berechtigungen abfragen |
| `/api/backup` | POST | create (OWNER/ADMIN) |
| `/api/backup/[id]/download` | GET | download (OWNER/ADMIN) |
| `/api/backup/restore/preview` | POST | preview (OWNER) |
| `/api/backup/restore/execute` | POST | restore (OWNER, `confirmed: true`) |

## Restore-Ablauf

1. Vorschau anzeigen (keine Datenänderung)
2. Warnung + Checkbox-Bestätigung im UI
3. Automatische Sicherheitskopie
4. Validierung des Backup-Formats
5. Restore mit Slug-Konfliktstrategie
6. Audit-Log-Eintrag

## Noch offene Erweiterungen

- PageTemplates, PlayerNotes, ShareLinks (ohne Tokens) im Backup-Format
- Geplante Auto-Backups (`autoBackupEnabled` → Scheduler)
- Users/Memberships vollständig im Restore-Pfad
