import type { ReactNode } from "react";
import {
  ArchiveRestore,
  ChevronDown,
  FolderCog,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import type {
  HostBackupEntry,
  LocalHostLogsResult,
  LocalHostStatus,
  LocalHostUpdateInfo,
} from "../../lib/tauri";
import { Button } from "../ui/button";
import { InfoTip } from "../ui/info-tip";
import { HostBackupsCard, HostLogsCard } from "./HostMaintenanceCards";
import type { BusyState } from "./host-format";

interface CommandCenterMaintenanceProps {
  status: LocalHostStatus | null;
  updateInfo: LocalHostUpdateInfo | null;
  busy: BusyState | null;
  root: string;
  autoStartHost: boolean;
  autoStartTunnel: boolean;
  stopServicesOnExit: boolean;
  autostartApp: boolean;
  directAiTransport: boolean;
  backups: HostBackupEntry[];
  logTarget: LocalHostLogsResult["target"];
  logs: string[];
  onRootChange: (value: string) => void;
  onAutoStartHostChange: (value: boolean) => void;
  onAutoStartTunnelChange: (value: boolean) => void;
  onStopServicesOnExitChange: (value: boolean) => void;
  onAutostartAppChange: (value: boolean) => void;
  onDirectAiTransportChange: (value: boolean) => void;
  onSaveSettings: () => void;
  onSetup: () => void;
  onOpenInstallWizard: () => void;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
  onRestart: () => void;
  onCreateBackup: () => void;
  onReloadBackups: () => void;
  onRestoreBackup: (name: string) => void;
  onSelectLog: (target: LocalHostLogsResult["target"]) => void;
}

export function CommandCenterMaintenance({
  status,
  updateInfo,
  busy,
  root,
  autoStartHost,
  autoStartTunnel,
  stopServicesOnExit,
  autostartApp,
  directAiTransport,
  backups,
  logTarget,
  logs,
  onRootChange,
  onAutoStartHostChange,
  onAutoStartTunnelChange,
  onStopServicesOnExitChange,
  onAutostartAppChange,
  onDirectAiTransportChange,
  onSaveSettings,
  onSetup,
  onOpenInstallWizard,
  onCheckUpdate,
  onInstallUpdate,
  onRestart,
  onCreateBackup,
  onReloadBackups,
  onRestoreBackup,
  onSelectLog,
}: CommandCenterMaintenanceProps) {
  const installChecks = status
    ? [
        ["Repository", status.installation.repoReady],
        ["Abhängigkeiten", status.installation.dependenciesReady],
        ["Umgebung", status.installation.envReady],
        ["Datenbank", status.installation.databaseReady],
        ["Produktions-Build", status.installation.buildReady],
      ] as const
    : [];

  return (
    <section className="command-center-maintenance" aria-labelledby="maintenance-title">
      <div className="command-center-section-heading">
        <div>
          <span className="connector-kicker">Bei Bedarf</span>
          <h3 id="maintenance-title">Einrichtung & Wartung</h3>
          <p>Technische Details bleiben griffbereit, ohne den täglichen Betrieb zu überladen.</p>
        </div>
      </div>

      <MaintenanceSection
        icon={<FolderCog size={19} />}
        title="Installation & Bereiche"
        description="Installationszustand prüfen, Bereiche ändern oder UWE neu bauen."
        badge={status?.installation.buildReady ? "Startklar" : "Aktion nötig"}
        open={Boolean(status && !status.installation.buildReady)}
      >
        <ul className="command-center-checklist">
          {installChecks.map(([label, ok]) => (
            <li key={label} className={ok ? "is-ok" : "is-missing"}>
              <span aria-hidden>{ok ? "✓" : "–"}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ul>
        <p className="connector-muted">
          {status?.installation.message ?? "Installationszustand wird ermittelt."}
        </p>
        {status ? (
          <p className="connector-muted">
            Installiert: <strong>{status.installation.apps.join(" · ")}</strong>
          </p>
        ) : null}
        <div className="connector-actions">
          <Button variant="primary" onClick={onSetup} disabled={busy !== null}>
            {status?.installation.buildReady ? "Reparieren / neu bauen" : "UWE einrichten"}
          </Button>
          <Button variant="secondary" onClick={onOpenInstallWizard} disabled={busy !== null}>
            Bereiche ändern
          </Button>
          <Button
            variant="ghost"
            onClick={onRestart}
            disabled={busy !== null || !status?.installation.buildReady}
          >
            Alle Dienste neu starten
          </Button>
        </div>
      </MaintenanceSection>

      <MaintenanceSection
        icon={<RefreshCw size={19} />}
        title="Software-Updates"
        description="Release prüfen und eine neue Version kontrolliert installieren."
        badge={updateInfo?.updateAvailable ? "Update verfügbar" : updateInfo ? "Aktuell" : "Nicht geprüft"}
        badgeTone={updateInfo?.updateAvailable ? "warning" : "neutral"}
        open={Boolean(updateInfo?.updateAvailable)}
      >
        {updateInfo ? (
          <div className="command-center-update-layout">
            <dl className="connector-kv">
              <div><dt>Installiert</dt><dd>{updateInfo.currentVersion ?? "–"} · {updateInfo.currentRevision ?? "–"}</dd></div>
              <div><dt>Verfügbar</dt><dd>{updateInfo.latestVersion ?? "–"} · {updateInfo.latestTag ?? "–"}</dd></div>
            </dl>
            <p className="connector-muted">
              Das Update synchronisiert den Release-Stand, migriert die Datenbank und baut
              die gewählten Bereiche neu. Lokale Änderungen werden vorher gesichert.
            </p>
          </div>
        ) : (
          <p className="connector-muted">
            Es wurde in dieser Sitzung noch nicht nach einem neuen UWE-Release gesucht.
          </p>
        )}
        <div className="connector-actions">
          <Button variant="secondary" onClick={onCheckUpdate} disabled={busy !== null}>
            Nach Updates suchen
          </Button>
          <Button
            variant="primary"
            onClick={onInstallUpdate}
            disabled={busy !== null || !updateInfo?.updateAvailable}
          >
            Update installieren
          </Button>
        </div>
      </MaintenanceSection>

      <MaintenanceSection
        icon={<Settings2 size={19} />}
        title="Lokales Hosting"
        description="Autostart, Lebensdauer und lokalen KI-Transport festlegen."
        badge="5 Einstellungen"
      >
        <div className="connector-form-grid command-center-settings-grid">
          <label className="connector-field connector-field-full">
            <span className="command-center-field-label">
              UWE-Projektordner
              <InfoTip label="UWE-Projektordner erklären">
                Der Checkout ist die Codequelle. Nutzdaten, Backups und Logs liegen getrennt im App-Datenordner.
              </InfoTip>
            </span>
            <input
              className="connector-input"
              value={root}
              onChange={(event) => onRootChange(event.target.value)}
              placeholder="C:\git\UWE"
              spellCheck={false}
            />
          </label>

          <SettingSwitch
            checked={autostartApp}
            onChange={onAutostartAppChange}
            label="Command Center bei Anmeldung starten"
            hint="Startet nur die Steuerungs-App mit Windows. Welche UWE-Dienste danach starten, legst du separat fest."
          />
          <SettingSwitch
            checked={autoStartHost}
            onChange={onAutoStartHostChange}
            label="UWE-Bereiche automatisch starten"
            hint="Startet die installierten Bereiche, sobald das Command Center geöffnet wird."
          />
          <SettingSwitch
            checked={autoStartTunnel}
            onChange={onAutoStartTunnelChange}
            label="Öffentlichen Tunnel automatisch starten"
            hint="Macht die konfigurierten Bereiche über Cloudflare erreichbar, sobald das Command Center läuft."
          />
          <SettingSwitch
            checked={stopServicesOnExit}
            onChange={onStopServicesOnExitChange}
            label="Dienste beim Beenden stoppen"
            hint="Empfohlen: Beenden trennt Tunnel und Dienste. Ohne diese Option bleibt UWE nach dem Schließen im Hintergrund erreichbar."
            recommended
          />
          <SettingSwitch
            checked={directAiTransport}
            onChange={onDirectAiTransportChange}
            label="KI-Jobs direkt zustellen"
            hint="Verwendet die schnelle lokale Verbindung zum Maschinenraum. Die Queue bleibt als zuverlässiger Fallback aktiv."
            recommended
          />
        </div>

        <div className="command-center-settings-footer">
          <div>
            <ShieldCheck aria-hidden size={18} />
            <span>
              {stopServicesOnExit
                ? "Sicheres Beenden ist aktiv: öffentliche Dienste werden getrennt."
                : "Hinweis: Dienste bleiben nach dem Beenden im Hintergrund aktiv."}
            </span>
          </div>
          <Button variant="primary" onClick={onSaveSettings} disabled={busy !== null}>
            Einstellungen speichern
          </Button>
        </div>
        {status ? (
          <small className="connector-muted">
            Stand: {status.branch ?? "detached"} · {status.revision ?? "unbekannt"} · Daten: {status.dataDir}
          </small>
        ) : null}
      </MaintenanceSection>

      <MaintenanceSection
        icon={<ArchiveRestore size={19} />}
        title="Backups & Protokolle"
        description="Daten sichern, wiederherstellen und bei Problemen die letzten Logzeilen prüfen."
        badge={`${backups.length} Backups`}
      >
        <div className="command-center-maintenance-grid">
          <HostBackupsCard
            backups={backups}
            disabled={busy !== null}
            canBackup={Boolean(status?.installation.databaseReady)}
            onCreate={onCreateBackup}
            onReload={onReloadBackups}
            onRestore={onRestoreBackup}
          />
          <HostLogsCard target={logTarget} lines={logs} onSelect={onSelectLog} />
        </div>
      </MaintenanceSection>
    </section>
  );
}

function MaintenanceSection({
  icon,
  title,
  description,
  badge,
  badgeTone = "neutral",
  open = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  badge: string;
  badgeTone?: "neutral" | "warning";
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="command-center-disclosure" open={open}>
      <summary>
        <span className="command-center-disclosure-icon" aria-hidden>{icon}</span>
        <span className="command-center-disclosure-copy">
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className={`command-center-disclosure-badge is-${badgeTone}`}>{badge}</span>
        <ChevronDown className="command-center-disclosure-chevron" aria-hidden size={19} />
      </summary>
      <div className="command-center-disclosure-content">{children}</div>
    </details>
  );
}

function SettingSwitch({
  checked,
  onChange,
  label,
  hint,
  recommended = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
  recommended?: boolean;
}) {
  return (
    <label className="command-center-setting">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="command-center-switch" aria-hidden><i /></span>
      <span className="command-center-setting-copy">
        <span>
          <strong>{label}</strong>
          {recommended ? <em>Empfohlen</em> : null}
        </span>
        <small>{hint}</small>
      </span>
    </label>
  );
}
