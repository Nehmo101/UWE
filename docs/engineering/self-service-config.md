# Self-Service-Konfiguration & Host-Sync

**Leitprinzip:** Alles, was den UWE-Host konfiguriert (Scheduling, Backups, Auto-Briefing,
Integrationen, Feature-Flags …), muss **in UWE selbst** einstellbar sein und automatisch
zum Host **zurückgesynct** werden. Der Betreiber soll so wenig wie möglich — idealerweise
nichts — laufend manuell auf dem Host konfigurieren.

Nur die **einmalige** Installation einer systemd-Unit (`cp` + `systemctl enable`) darf
manuell bleiben. Ab da wird alles über die UWE-Oberfläche gesteuert.

## Das Muster: DB-Setting → host-lesbare Datei → systemd liest

```
Studio-UI (Toggle)
   │  Server Action (updateSettingsAction)
   ▼
System-Settings (DB)  ──►  Sync-Wrapper  ──►  host-lesbare JSON  ◄── liest ── systemd-Skript
 settings-service.ts       *-schedule-sync.ts    data/**/schedule.json      deploy/scripts/*.sh
                                                                                   ▲
                                                                        statischer systemd-Timer
```

Der systemd-**Timer** feuert zu einer festen Zeit; das **Skript** liest die JSON und
entscheidet, ob (und wie) es tatsächlich läuft. So ist der Zeitplan/An-Aus aus UWE
steuerbar, ohne Units neu zu schreiben.

## Referenz-Implementierungen

### Backup-Auto-Schedule (Vorbild)

| Schritt | Datei |
|---|---|
| Setting + Default (`autoBackupEnabled`) | `packages/database/src/settings-service.ts` |
| Validierung (`BACKUP_KEYS`) | `packages/database/src/settings-validation.ts` |
| UI-Toggle + Speichern | Studio-Settings → `apps/studio/app/settings-actions.ts` |
| Sync-Wrapper | `apps/studio/src/lib/backup-schedule-sync.ts` |
| Host-Writer (JSON) | `writeBackupScheduleConfig` in `packages/backup/src/schedule.ts` |
| systemd liest JSON | `deploy/scripts/uwe-backup.sh` (`schedule.json`) |

### Auto-Briefing

| Schritt | Datei |
|---|---|
| Setting + Default (`autoBriefingEnabled`) | `packages/database/src/settings-service.ts` |
| Sync-Wrapper | `apps/studio/src/lib/briefing-schedule-sync.ts` |
| Host-Writer (JSON) | `data/briefings/schedule.json` |
| Interner Trigger (Job im laufenden Server) | `apps/studio/app/api/internal/briefing/route.ts` |
| systemd liest JSON + triggert | `deploy/scripts/uwe-briefing.sh`, `deploy/systemd/uwe-briefing.{timer,service}` |

## Checkliste: neues Host-nahes Feature self-service machen

1. **Setting** in `settings-service.ts` ergänzen (Gruppe + sinnvoller Default) und in
   `settings-validation.ts` freischalten.
2. **UI-Toggle** in den Studio-Settings; Speichern über die bestehende Settings-Action.
3. **Sync-Wrapper** (`apps/studio/src/lib/*-sync.ts`) schreibt nach dem Speichern eine
   **host-lesbare** JSON unter `data/**` (Writer im Feature-Package, nicht in `packages/database`).
4. **systemd-Skript** liest die JSON und gated Ausführung/Parameter; Timer bleibt statisch.
5. **Kein neuer laufender Host-Schritt.** Braucht das Feature ausführende Logik im
   laufenden Server (z. B. In-Process-Job-Dispatch), triggert das Skript eine interne,
   `STUDIO_API_TOKEN`-geschützte Route (`app/api/internal/*`) statt eines eigenen CLI-Prozesses.

## Anti-Pattern

- Konfiguration, die nur per SSH / `.env`-Edit / Unit-Neuschreibung auf dem Host änderbar ist.
- Host-Writer/Domänenlogik in `packages/database` (gehört ins Feature-Package).
- Sekrete oder laufende Parameter im systemd-Unit-File statt in der host-lesbaren JSON /
  `/etc/uwe/uwe.env`.
