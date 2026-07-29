# Backup, Export & Restore — Architektur

Stand: v0.1.x. Sicheres Backup/Restore für UWE-Daten.

## Backup anlegen

```bash
pnpm backup:create
```

Ein Backup umfasst Datenbank und Uploads. Zeitpläne werden nicht hier, sondern
in den Studio-Einstellungen gesetzt — der Host liest sie über das
Self-Service-Muster ([engineering/self-service-config.md](engineering/self-service-config.md)).
Wiederherstellung: [backup-restore.md](backup-restore.md).

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
- **Medien**: Asset-Dateien im ZIP unter `assets/` (inkl. Capture-Upload-Dateien unter `assets/_capture/`)
- **Daily Admin OS** (nur Vollbackup): Capture-Einträge, Persönliche Projekte, Werkstatt (Projekte, Farbrezepte, Druckprofile, Terrain-Vermietung), Verträge/Ausgaben, Hardware-Geräte, Admin-Verknüpfungen (`AdminEntityLink`)
- **Life Brain** (nur Vollbackup): PersonalBrainDocuments, -Chunks (inkl. Embeddings), -Facts — Backups bleiben lokal auf dem Host
- **Settings**: SystemSettings (sanitized, keine Secrets) — nur bei Vollbackup
- **Voll-Exporte Brain & Family** (nur Vollbackup): `brain-export.json` (ALLE 35 Modelle aus `uwe-brain.db`, u.a. das komplette Mail-Center — ohne `passwordEnc`/`oauthTokenEnc`) und `family-export.json` (alle 18 Modelle aus `uwe-family.db`). Vollständigkeit ist per Test an `BRAIN_MODEL_NAMES`/`FAMILY_MODEL_NAMES` gepinnt; für sie gibt es noch keinen selektiven Restore-Pfad — sie sind das Disaster-Recovery-Netz (JSON im ZIP, manuell einspielbar)
- **Nicht enthalten**: Passwort-Hashes, Session-Tokens, API-Keys, Mail-Zugangsdaten, `.env`-Secrets
- **Bekannte Lücke (uwe.db)**: `data.json` deckt bewusst nur die Restore-fähigen Kern-Modelle ab; alles Weitere (z. B. Characters, RollTables, WorldCalendar) sichert nur der rohe SQLite-Snapshot. `packages/backup/src/core-backup-coverage.test.ts` pinnt diese Liste — ein neues Modell muss dort triagiert werden
- **Rückwärtskompatibilität**: `data.dailyAdmin`, `brain-export.json` und `family-export.json` sind optional — ältere Archive ohne diese Abschnitte lassen sich weiter wiederherstellen

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

- ~~Geplante Auto-Backups~~ — **Erledigt:** `autoBackupEnabled` schreibt `schedule.json` für Host-Timer (`backup-schedule-sync.ts`)

**Erledigt:** PageTemplates, PlayerNotes, ShareLinks (ohne Tokens) im Backup-Format; Users/Memberships im Restore-Pfad.
