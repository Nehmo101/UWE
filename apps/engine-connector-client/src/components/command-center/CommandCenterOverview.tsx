import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Hourglass,
  Play,
  RefreshCw,
  Server,
  Square,
  Wrench,
} from "lucide-react";

import type {
  ConnectorRuntimeStatus,
  LocalHostServiceId,
  LocalHostStatus,
  LocalHostUpdateInfo,
} from "../../lib/tauri";
import {
  humanizeConnectionStatus,
  toHealthBadgeStatus,
} from "../../lib/connector-runtime-labels";
import { Button } from "../ui/button";
import { InfoTip } from "../ui/info-tip";
import { formatBytes, formatDuration, type BusyState } from "./host-format";
import { commandCenterGuidance } from "./view-model";

interface CommandCenterOverviewProps {
  status: LocalHostStatus | null;
  connectorStatus: ConnectorRuntimeStatus;
  updateInfo: LocalHostUpdateInfo | null;
  busy: BusyState | null;
  busyService: string | null;
  onSetup: () => void;
  onStartAll: () => void;
  onStopAll: () => void;
  onRefresh: () => void;
  onOpenService: (serviceId: LocalHostServiceId) => void;
  onServiceAction: (
    serviceId: LocalHostServiceId,
    action: "start" | "stop" | "restart",
  ) => void;
  onOpenConnector: () => void;
  onOpenInstallWizard: () => void;
  onCheckUpdate: () => void;
}

export function CommandCenterOverview({
  status,
  connectorStatus,
  updateInfo,
  busy,
  busyService,
  onSetup,
  onStartAll,
  onStopAll,
  onRefresh,
  onOpenService,
  onServiceAction,
  onOpenConnector,
  onOpenInstallWizard,
  onCheckUpdate,
}: CommandCenterOverviewProps) {
  const guidance = commandCenterGuidance(status);
  const services = status?.services ?? [];
  const healthyCount = services.filter((service) => service.healthy).length;
  const anyRunning = services.some((service) => service.state !== "stopped");
  const allOnline = services.length > 0 && healthyCount === services.length;
  const launchService = services.find((service) => service.id === "studio") ?? services[0];
  // „wait" heißt: es läuft bereits eine Einrichtung oder ein Update. Der Knopf
  // bleibt sichtbar (sonst springt das Layout), führt aber nichts aus.
  const primaryDisabled = busy !== null || status === null || guidance.primaryAction === "wait";

  function runPrimaryAction() {
    if (guidance.primaryAction === "wait") return;
    if (guidance.primaryAction === "setup") {
      onSetup();
      return;
    }
    if (guidance.primaryAction === "open" && launchService) {
      onOpenService(launchService.id);
      return;
    }
    onStartAll();
  }

  return (
    <>
      <section
        className={`command-center-overview is-${guidance.tone}`}
        aria-labelledby="command-center-title"
      >
        <div className="command-center-overview-copy">
          <span className="connector-kicker">{guidance.eyebrow}</span>
          <h3 id="command-center-title">{guidance.title}</h3>
          <p>{guidance.description}</p>

          <div className="command-center-command-row">
            <Button
              className="command-center-main-action"
              variant="accent"
              size="lg"
              onClick={runPrimaryAction}
              disabled={primaryDisabled}
            >
              {guidance.primaryAction === "wait" ? (
                <Hourglass aria-hidden size={18} />
              ) : guidance.primaryAction === "setup" ? (
                <Wrench aria-hidden size={18} />
              ) : guidance.primaryAction === "open" ? (
                <ArrowUpRight aria-hidden size={18} />
              ) : (
                <Play aria-hidden size={18} />
              )}
              {guidance.primaryLabel}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={onStopAll}
              disabled={busy !== null || (!anyRunning && connectorStatus.status !== "running")}
              title="Stoppt UWE, den öffentlichen Tunnel und den Maschinenraum."
            >
              <Square aria-hidden size={16} />
              Alles stoppen
            </Button>
            <Button
              className="command-center-refresh"
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={busy !== null}
              aria-label="Systemstatus aktualisieren"
              title="Systemstatus aktualisieren"
            >
              <RefreshCw aria-hidden size={17} />
            </Button>
          </div>
        </div>

        <div className="command-center-pulse" aria-label="Systemzusammenfassung">
          <div className={`command-center-pulse-orb is-${guidance.tone}`} aria-hidden>
            <span />
          </div>
          <strong>{allOnline ? "ONLINE" : anyRunning ? "TEILBETRIEB" : "OFFLINE"}</strong>
          <small>{status?.host.hostname ?? "Lokaler Rechner"}</small>
        </div>
      </section>

      <section className="command-center-summary" aria-label="Schnellstatus">
        <SummaryItem
          label="UWE Bereiche"
          value={status ? `${healthyCount} / ${services.length} online` : "Wird geladen"}
          tone={allOnline ? "ok" : healthyCount > 0 ? "warning" : "neutral"}
        />
        <SummaryItem
          label="Installation"
          value={status?.installation.buildReady ? "Startklar" : "Aktion nötig"}
          tone={status?.installation.buildReady ? "ok" : "warning"}
        />
        <button
          type="button"
          className={`command-center-summary-item is-action ${toHealthBadgeStatus(connectorStatus) === "ok" ? "is-ok" : "is-neutral"}`}
          onClick={onOpenConnector}
        >
          <span>Maschinenraum</span>
          <strong>{humanizeConnectionStatus(connectorStatus.connectionStatus)}</strong>
          <ArrowUpRight aria-hidden size={16} />
        </button>
        <button
          type="button"
          className={`command-center-summary-item is-action${updateInfo?.updateAvailable ? " is-warning" : ""}`}
          onClick={onCheckUpdate}
          disabled={busy !== null}
        >
          <span>Software</span>
          <strong>
            {updateInfo?.updateAvailable
              ? "Update verfügbar"
              : updateInfo
                ? "Aktuell"
                : "Update prüfen"}
          </strong>
          <ArrowUpRight aria-hidden size={16} />
        </button>
      </section>

      <section className="command-center-section-block" aria-labelledby="services-title">
        <div className="command-center-section-heading">
          <div>
            <span className="connector-kicker">Deine Bereiche</span>
            <h3 id="services-title">Dienste im Blick</h3>
          </div>
          <Button variant="ghost" onClick={onOpenInstallWizard} disabled={busy !== null}>
            Bereiche verwalten
          </Button>
        </div>

        <div className="command-center-service-grid">
          {services.map((service) => {
            const serviceBusy = busyService?.startsWith(`${service.id}:`) ?? false;
            return (
              <article
                key={service.id}
                className={`command-center-service-card is-${service.healthy ? "online" : service.state}`}
              >
                <div className="command-center-service-head">
                  <span className="command-center-service-icon" aria-hidden>
                    <Server size={18} />
                  </span>
                  <div>
                    <h4>{service.label}</h4>
                    <span className="command-center-service-state">
                      <i aria-hidden />
                      {service.healthy
                        ? "Online"
                        : service.state === "starting"
                          ? "Startet"
                          : service.state === "error"
                            ? "Fehler"
                            : "Gestoppt"}
                    </span>
                  </div>
                </div>
                <p>{service.message}</p>
                <code>{service.url}</code>
                <div className="command-center-service-actions">
                  {service.healthy ? (
                    <Button variant="primary" size="sm" onClick={() => onOpenService(service.id)}>
                      Öffnen <ArrowUpRight aria-hidden size={14} />
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onServiceAction(service.id, "start")}
                      disabled={serviceBusy || busy !== null}
                    >
                      {serviceBusy ? "Startet …" : "Starten"}
                    </Button>
                  )}
                  {service.state !== "stopped" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onServiceAction(service.id, "restart")}
                      disabled={serviceBusy || busy !== null}
                    >
                      Neustart
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="command-center-section-block" aria-labelledby="hardware-title">
        <div className="command-center-section-heading is-compact">
          <div>
            <span className="connector-kicker">Dieser Rechner</span>
            <h3 id="hardware-title">Ressourcen</h3>
          </div>
          <InfoTip label="Ressourcenanzeige erklären">
            Momentaufnahme des lokalen Rechners. Die Werte werden mit dem Systemstatus aktualisiert.
          </InfoTip>
        </div>
        <div className="command-center-metric-grid">
          <Metric
            icon={<Cpu size={18} />}
            label="Prozessor"
            value={status ? `${status.host.cpuCores} Kerne` : "–"}
            detail={status?.host.cpuModel ?? "Wird ermittelt"}
          />
          <Metric
            icon={<Database size={18} />}
            label="Arbeitsspeicher"
            value={status ? formatBytes(status.host.ramUsedBytes) : "–"}
            detail={status ? `von ${formatBytes(status.host.ramTotalBytes)} belegt` : "Wird ermittelt"}
          />
          <Metric
            icon={<HardDrive size={18} />}
            label="Datenträger"
            value={status ? formatBytes(status.host.diskUsedBytes) : "–"}
            detail={status ? `von ${formatBytes(status.host.diskTotalBytes)} belegt` : "Wird ermittelt"}
          />
          <Metric
            icon={<CheckCircle2 size={18} />}
            label="GPU"
            value={status?.gpu.name ?? "Nicht erkannt"}
            detail={
              status?.gpu.vramTotalMb
                ? `${Math.round(status.gpu.vramTotalMb / 1024)} GB VRAM`
                : status
                  ? `PC läuft seit ${formatDuration(status.host.uptimeSeconds)}`
                  : "Wird ermittelt"
            }
          />
        </div>
      </section>
    </>
  );
}

function SummaryItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warning" | "neutral";
}) {
  return (
    <div className={`command-center-summary-item is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="command-center-metric">
      <span className="command-center-metric-icon" aria-hidden>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}
