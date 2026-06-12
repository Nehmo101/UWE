# Backup, Export & Restore — Architektur und offene Punkte

Stand: v0.1.x. Dieses Dokument beschreibt, was Backups heute abdecken, wie der
Zielzustand aussieht und welche TODOs offen sind.

## Was heute funktioniert

| Fähigkeit | Status | Wo |
|-----------|--------|-----|
| World-/Kampagnen-/Voll-Backup als ZIP oder JSON | ✅ | `packages/backup`, UI unter `/backup`, API `/api/backup` |
| Asset-Dateien im ZIP enthalten | ✅ | `packages/backup/src/archive.ts` |
| Restore mit Vorschau + expliziter Bestätigung | ✅ | `/api/backup/restore/preview` + `/execute` |
| Sanitization (keine Passwort-Hashes, Session-Tokens, API-Keys) | ✅ | `packages/backup/src/sanitize.ts` (harte Fehler bei Fund) |
| Statischer, spielersicherer HTML-Export | ✅ | `packages/static-export`, `pnpm export:static` |
| Lokales DB-Backup vor riskanten Migrationen (Docker) | ✅ | `scripts/docker-entrypoint.sh` legt vor ausstehenden Migrationen `data/backups/pre-migration-<ts>.db` an |
| Backup-/Restore-Ereignisse im Activity Log | ✅ | `backup_created` / `backup_restored` Einträge, sichtbar im Dashboard |

## Welche Daten ein vollständiges World-Backup braucht

Aktuell enthalten (`packages/backup/src/types.ts` / `collect.ts`):
Worlds, Campaigns, Pages, ContentBlocks, PageLinks, Assets (+ Dateien),
AssetPageLinks, GameSessions (+ Links), LabelTemplates, Labels,
SoundboardButtons (+ Links), WorldMemberships, PagePlayerAccess,
SessionUnlocks, Users (ohne Passwort-Hashes).

**Noch nicht enthalten (TODOs):**

- [ ] **PageTemplates** — Nutzerdefinierte Quick-Create-Templates sind global
      (nicht welt-gebunden) und fehlen im Backup-Format. TODO: eigener
      `pageTemplates`-Abschnitt im `BackupData`-Format + Restore-Pfad
      (Konfliktstrategie: Slug-Abgleich, System-Templates überspringen).
- [ ] **SystemSettings** — globale Einstellungen (Portal-Schalter, Pfade).
      TODO: optionaler Abschnitt, beim Restore nur nach explizitem Opt-in
      anwenden (Pfade können maschinenspezifisch sein).
- [ ] **PlayerNotes** — Spielernotizen hängen an Welt/Kampagne und gehen bei
      einem Restore in eine leere Instanz verloren.
- [ ] **ShareLinks** — bewusst ausgelassen (Tokens sind Secrets). TODO:
      entscheiden, ob Links ohne Token/Passwort-Hash exportiert und beim
      Restore neu generiert werden sollen.
- [ ] **ActivityLog / UndoEntries / SeedHistory** — Audit-Daten. Bewusst nicht
      Teil von World-Backups (Audit bleibt instanzgebunden); für
      Komplett-Migrationen einer Instanz genügt die Kopie der SQLite-Datei
      (`data/uwe.db`) plus `data/uploads`.

## Zielzustand

1. **World als JSON/ZIP exportieren** — vorhanden.
2. **Restore/Import** — vorhanden (Preview + confirmed-Flag).
3. **Lokale Backups vor riskanten Migrationen** — für Docker umgesetzt
   (Entrypoint). Für manuelle Deployments: vor `pnpm db:migrate` die Datei
   `packages/database/data/uwe.db` kopieren.
4. **Markdown-Export (optional)** — TODO: Export der Seiten als
   Markdown-Ordnerstruktur (ein Verzeichnis pro Nav-Kategorie, Frontmatter mit
   Typ/Sichtbarkeit/Tags). Sinnvoller Einstiegspunkt: eigenes Paket neben
   `static-export`, das `combineBlockContent` nutzt und Sichtbarkeit
   respektiert (DM-Variante komplett, Player-Variante gefiltert wie Portal).

## Sicherheitsregeln (unverändert gültig)

- Backups dürfen **niemals** Passwort-Hashes, Session-Tokens oder API-Keys
  enthalten — `sanitizeBackupData` wirft sonst einen harten Fehler.
- Restore erfordert immer eine Vorschau plus `confirmed: true`.
- Statische Exporte enthalten ausschließlich portal-sichtbare, veröffentlichte
  Inhalte und laufen durch `auditStaticExport`.
