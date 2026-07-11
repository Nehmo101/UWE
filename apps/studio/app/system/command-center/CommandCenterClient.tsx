"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CollapsibleSection } from "@uwe/shared-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Alert } from "@/src/components/ui/states";
import { Badge } from "@/src/components/ui/badge";
import type {
  CommandCenterData,
  CommandCenterOperations,
} from "@/src/lib/command-center-data";
import type {
  CommandCenterSnapshot,
  DiskUsage,
  HostSeverity,
  HostSecurityCheck,
  NetworkCounters,
  SystemdUnitStatus,
} from "@uwe/host-monitor";
import { formatBytes, formatDuration, formatClock, formatRate } from "./format";
import {
  Sparkline,
  OpenPortsPanel,
  RecentErrorsPanel,
  FailedLoginsPanel,
} from "./CommandCenterDiagnostics";

const POLL_INTERVAL_MS = 10_000;
const HISTORY_LENGTH = 30;

const DOT_CLASS: Record<HostSeverity, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  error: "bg-destructive",
  unknown: "bg-muted-foreground/40",
};

const SEVERITY_LABEL: Record<HostSeverity, string> = {
  ok: "OK",
  warn: "Achtung",
  error: "Kritisch",
  unknown: "Unbekannt",
};

function SeverityDot({ severity }: { severity: HostSeverity }) {
  return <span className={`inline-block size-2 flex-none rounded-full ${DOT_CLASS[severity]}`} aria-hidden />;
}

/** A labelled row with a leading severity dot — the Command Center's list idiom. */
function StatusRow({
  severity,
  label,
  value,
  manual,
}: {
  severity: HostSeverity;
  label: string;
  value: string;
  manual?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <div className="flex min-w-0 items-center gap-2">
        <SeverityDot severity={severity} />
        <span className="truncate">{label}</span>
        {manual ? (
          <Badge variant="default" className="shrink-0">
            manuell
          </Badge>
        ) : null}
      </div>
      <span className="shrink-0 text-right font-mono text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  severity,
  sparkline,
  sparklineMax,
}: {
  label: string;
  value: string;
  hint?: string;
  severity?: HostSeverity;
  sparkline?: number[];
  sparklineMax?: number;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-3 text-card-foreground shadow-sm">
      <div className="flex items-center gap-2">
        {severity ? <SeverityDot severity={severity} /> : null}
        <span className="block text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="block text-xl font-bold leading-tight">{value}</span>
      {hint ? <span className="mt-1 block text-sm text-muted-foreground">{hint}</span> : null}
      {sparkline ? <Sparkline values={sparkline} max={sparklineMax} /> : null}
    </div>
  );
}

function HostMetricsBlock({
  host,
  history,
  throughput,
}: {
  host: CommandCenterSnapshot;
  history: MetricHistory;
  throughput: Throughput;
}) {
  const m = host.host;
  const disks = host.disks;
  const net = host.network;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Host-Metriken</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="mb-2 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
          <StatCard label="Host-Uptime" value={formatDuration(m.hostUptimeSeconds)} hint={`Boot ${formatClock(m.hostBootTime)}`} />
          <StatCard label="UWE-Uptime" value={formatDuration(m.appUptimeSeconds)} hint={`Start ${formatClock(m.appStartTime)}`} />
          <StatCard
            label="CPU-Last (1 min)"
            value={m.cpu.loadPercent == null ? "—" : `${m.cpu.loadPercent}%`}
            hint={`${m.loadAverage.one.toFixed(2)} · ${m.cpu.cores} Kerne`}
            severity={m.cpu.severity}
            sparkline={history.cpu}
            sparklineMax={100}
          />
          <StatCard
            label="RAM belegt"
            value={`${m.memory.usedPercent}%`}
            hint={`${formatBytes(m.memory.usedBytes)} / ${formatBytes(m.memory.totalBytes)}`}
            severity={m.memory.severity}
            sparkline={history.mem}
            sparklineMax={100}
          />
          <StatCard
            label="Netzwerk ↓ Empfang"
            value={net.available ? formatRate(throughput.rx) : "—"}
            hint={net.available ? `${net.interfaces.length} Interface(s)` : "keine /proc/net/dev"}
            sparkline={history.rx}
          />
          <StatCard
            label="Netzwerk ↑ Senden"
            value={net.available ? formatRate(throughput.tx) : "—"}
            hint={net.available ? `gesamt ${formatBytes(net.txBytes)}` : "keine /proc/net/dev"}
            sparkline={history.tx}
          />
        </div>

        <div className="mb-2 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
          {disks.map((disk: DiskUsage) => (
            <StatCard
              key={disk.path}
              label={disk.label}
              value={disk.usedPercent == null ? "—" : `${disk.usedPercent}%`}
              hint={
                disk.totalBytes == null
                  ? disk.message
                  : `${formatBytes(disk.freeBytes)} frei / ${formatBytes(disk.totalBytes)}`
              }
              severity={disk.severity}
            />
          ))}
        </div>

        <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Host</dt>
          <dd className="font-mono break-all">{m.hostname} · {m.platform} {m.release}</dd>
          <dt className="text-muted-foreground">CPU</dt>
          <dd className="font-mono break-all">{m.cpu.model}</dd>
          <dt className="text-muted-foreground">Node</dt>
          <dd className="font-mono break-all">{m.nodeVersion}</dd>
          <dt className="text-muted-foreground">Prozess (RSS)</dt>
          <dd className="font-mono break-all">{formatBytes(m.process.rssBytes)}</dd>
          <dt className="text-muted-foreground">IP (LAN)</dt>
          <dd className="font-mono break-all">{m.primaryIpv4 ?? "—"}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function ServicesBlock({ services }: { services: SystemdUnitStatus[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>systemd Dienste &amp; Timer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          {services.map((service) => (
            <StatusRow
              key={service.unit}
              severity={service.severity}
              label={service.label}
              value={
                service.kind === "timer" && service.nextElapse
                  ? `${service.message} · nächste ${formatClock(service.nextElapse)}`
                  : service.message
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityBlock({ checks }: { checks: HostSecurityCheck[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Host-Sicherheit</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          {checks.map((check) => (
            <StatusRow
              key={check.id}
              severity={check.severity}
              label={check.label}
              value={check.message}
              manual={check.manual}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function homelabDot(severity: string): HostSeverity {
  if (severity === "ok" || severity === "warn" || severity === "error") return severity;
  return "unknown";
}

function OperationsBlock({ operations }: { operations: CommandCenterOperations }) {
  const { health, services, securityChecks, alerts } = operations;
  const healthSeverity: HostSeverity =
    health.light === "green" ? "ok" : health.light === "yellow" ? "warn" : "error";
  const securityIssues = securityChecks.filter(
    (check) => check.severity === "error" || (check.severity === "warn" && !check.ok),
  );
  const serviceIssues = services.filter(
    (service) => service.severity === "error" || (service.severity === "warn" && !service.ok),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>UWE-Betrieb</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {alerts.messages.length > 0 ? (
          <Alert tone="warning" icon="server-cog" title={`${alerts.criticalCount} offene Punkte`}>
            {alerts.messages.join(" · ")}
          </Alert>
        ) : (
          <Alert tone="success" icon="shield-check" title="UWE-Betrieb unauffällig">
            <Link href="/system?tab=diagnose" className="underline decoration-dotted underline-offset-2">
              Vollständige Diagnose im System-Hub →
            </Link>
          </Alert>
        )}

        <div className="mb-2 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
          <StatCard label="Health-Ampel" value={SEVERITY_LABEL[healthSeverity]} severity={healthSeverity} />
          <StatCard label="DB-Größe" value={health.dbSizeLabel} />
          <StatCard label="Uploads" value={health.uploads.totalLabel} hint={`${health.uploads.count} Dateien`} />
          <StatCard
            label="Migrationen"
            value={health.migrationsOk ? "OK" : "Ausstehend"}
            hint={health.pendingMigrations > 0 ? `${health.pendingMigrations} offen` : undefined}
            severity={health.migrationsOk ? "ok" : "error"}
          />
        </div>

        {serviceIssues.length > 0 ? (
          <div className="text-sm">
            {serviceIssues.map((service) => (
              <StatusRow
                key={service.id}
                severity={homelabDot(service.severity)}
                label={service.label}
                value={service.message}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Alle Homelab-Dienste unauffällig.{" "}
            <Link href="/system?tab=homelab" className="underline decoration-dotted underline-offset-2">
              Homelab-Details →
            </Link>
          </p>
        )}

        {securityIssues.length > 0 ? (
          <Alert tone="warning" icon="shield" title={`${securityIssues.length} Studio-Sicherheitshinweis(e)`}>
            {securityIssues.map((issue) => issue.label).join(" · ")}
          </Alert>
        ) : null}

        <p className="text-sm text-muted-foreground">
          <Link href="/system" className="underline decoration-dotted underline-offset-2">
            System-Hub
          </Link>
          {" · "}
          <Link href="/system/health" className="underline decoration-dotted underline-offset-2">
            Health-Ampel
          </Link>
          {" · "}
          <Link href="/system/host-control" className="underline decoration-dotted underline-offset-2">
            Host Control
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

interface MetricHistory {
  cpu: number[];
  mem: number[];
  rx: number[];
  tx: number[];
}

interface Throughput {
  rx: number | null;
  tx: number | null;
}

const EMPTY_HISTORY: MetricHistory = { cpu: [], mem: [], rx: [], tx: [] };

function pushCapped(values: number[], value: number): number[] {
  const next = [...values, value];
  return next.length > HISTORY_LENGTH ? next.slice(next.length - HISTORY_LENGTH) : next;
}

type NetSample = Pick<NetworkCounters, "rxBytes" | "txBytes" | "sampledAtMs">;

export function CommandCenterClient({ initial }: { initial: CommandCenterData }) {
  const [data, setData] = useState<CommandCenterData>(initial);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<MetricHistory>(EMPTY_HISTORY);
  const [throughput, setThroughput] = useState<Throughput>({ rx: null, tx: null });
  const inFlight = useRef(false);
  const prevNet = useRef<NetSample | null>(null);
  const lastSampleAt = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch("/api/system/command-center", { cache: "no-store" });
      if (!response.ok) {
        setStale(true);
        return;
      }
      const next = (await response.json()) as CommandCenterData;
      setData(next);
      setStale(false);
    } catch {
      setStale(true);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh();
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Derive sparkline history + network throughput from each fresh snapshot.
  // Throughput is a rate, so it needs two consecutive /proc/net/dev samples.
  useEffect(() => {
    const snapshot = data.host;
    if (lastSampleAt.current === snapshot.collectedAt) return;
    lastSampleAt.current = snapshot.collectedAt;

    const cpu = snapshot.host.cpu.loadPercent ?? 0;
    const mem = snapshot.host.memory.usedPercent;

    let rxRate: number | null = null;
    let txRate: number | null = null;
    const net = snapshot.network;
    if (net.available) {
      const previous = prevNet.current;
      if (previous && net.sampledAtMs > previous.sampledAtMs) {
        const elapsedSeconds = (net.sampledAtMs - previous.sampledAtMs) / 1000;
        if (elapsedSeconds > 0) {
          rxRate = Math.max(0, net.rxBytes - previous.rxBytes) / elapsedSeconds;
          txRate = Math.max(0, net.txBytes - previous.txBytes) / elapsedSeconds;
        }
      }
      prevNet.current = { rxBytes: net.rxBytes, txBytes: net.txBytes, sampledAtMs: net.sampledAtMs };
    }

    setThroughput({ rx: rxRate, tx: txRate });
    setHistory((prev) => ({
      cpu: pushCapped(prev.cpu, cpu),
      mem: pushCapped(prev.mem, mem),
      rx: rxRate == null ? prev.rx : pushCapped(prev.rx, rxRate),
      tx: txRate == null ? prev.tx : pushCapped(prev.tx, txRate),
    }));
  }, [data]);

  const overall = data.host.overall;
  const diagnosticIssues =
    data.host.openPorts.ports.length > 0 ||
    data.host.recentErrors.entries.length > 0 ||
    data.host.failedLogins.recent.length > 0;
  const securityIssues =
    data.host.security.some((check) => check.severity !== "ok") ||
    data.operations.securityChecks.some(
      (check) => check.severity === "error" || (check.severity === "warn" && !check.ok),
    );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-2xl font-semibold">Kommandozentrale</h1>
        <p className="text-sm text-muted-foreground">
          Live-Überblick des UWE-Linux-Hosts: Uptime, Systemlast, Dienste und Sicherheit. Read-only
          Monitoring — keine destruktiven Aktionen. Host-Neustart und Wartung:{" "}
          <Link href="/system/host-control" className="underline decoration-dotted underline-offset-2">
            Host Control
          </Link>
          . Aktualisiert sich alle 10&nbsp;Sekunden automatisch.
        </p>
        <p className="text-sm text-muted-foreground">
          <Link href="/system" className="underline decoration-dotted underline-offset-2">
            System-Hub
          </Link>
          {" · "}
          <Link href="/system/health" className="underline decoration-dotted underline-offset-2">
            Health-Ampel
          </Link>
          {" · "}
          <Link href="/system/host-control" className="underline decoration-dotted underline-offset-2">
            Host Control
          </Link>
          {" · "}
          <Link href="/system?tab=diagnose" className="underline decoration-dotted underline-offset-2">
            Diagnose
          </Link>
        </p>
      </header>

      <Alert
        tone={overall === "ok" ? "success" : overall === "error" ? "danger" : "warning"}
        icon={overall === "ok" ? "shield-check" : "server-cog"}
        title={`Gesamtstatus: ${SEVERITY_LABEL[overall]}`}
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Zuletzt aktualisiert: {formatClock(data.host.collectedAt)}</span>
          {stale ? <span className="text-destructive">· letzte Aktualisierung fehlgeschlagen</span> : null}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="underline decoration-dotted underline-offset-2 disabled:opacity-50"
          >
            {refreshing ? "Aktualisiere…" : "Jetzt aktualisieren"}
          </button>
        </span>
      </Alert>

      <CollapsibleSection title="Live Host" defaultOpen>
        <div className="flex flex-col gap-6">
          <HostMetricsBlock host={data.host} history={history} throughput={throughput} />
          <ServicesBlock services={data.host.services} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Sicherheit"
        summary={securityIssues ? "Hinweise vorhanden" : "Unauffällig"}
        defaultOpen={securityIssues}
      >
        <div className="flex flex-col gap-6">
          <SecurityBlock checks={data.host.security} />
          <OperationsBlock operations={data.operations} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Diagnose"
        summary={`${data.host.openPorts.ports.length} Ports · ${data.host.recentErrors.entries.length} Journal · ${data.host.failedLogins.recent.length} Logins`}
        defaultOpen={diagnosticIssues}
      >
        <div className="flex flex-col gap-6">
          <OpenPortsPanel data={data.host.openPorts} />
          <RecentErrorsPanel data={data.host.recentErrors} />
          <FailedLoginsPanel data={data.host.failedLogins} />
        </div>
      </CollapsibleSection>
    </div>
  );
}
