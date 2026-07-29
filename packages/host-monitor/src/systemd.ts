import {
  resolveHostReadDeps,
  type CommandRunner,
  type HostReadDeps,
} from "./runner";
import type { HostSeverity, SystemdUnitKind, SystemdUnitStatus } from "./types";

export interface SystemdUnitSpec {
  unit: string;
  label: string;
  kind: SystemdUnitKind;
  optional?: boolean;
}

/** The UWE units and timers the Command Center watches by default. */
export const DEFAULT_UWE_UNITS: SystemdUnitSpec[] = [
  { unit: "uwe.service", label: "UWE Dienst", kind: "service" },
  { unit: "uwe-rtx-connector.service", label: "Maschinenraum", kind: "service", optional: true },
  { unit: "uwe-healthcheck.timer", label: "Healthcheck", kind: "timer" },
  { unit: "uwe-backup.timer", label: "Backup", kind: "timer" },
  { unit: "uwe-briefing.timer", label: "Auto-Briefing", kind: "timer" },
  { unit: "uwe-mail-sync.timer", label: "Mail-Sync", kind: "timer" },
  { unit: "uwe-nightly-restart.timer", label: "Nächtlicher Neustart", kind: "timer" },
];

const SHOW_PROPERTIES = [
  "LoadState",
  "ActiveState",
  "SubState",
  "NextElapseUSecRealtime",
] as const;

/** Parse `key=value` lines from `systemctl show` into a lookup map. */
export function parseSystemctlShow(stdout: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const index = line.indexOf("=");
    if (index <= 0) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
}

/** systemd timers report the next elapse as µs since the epoch (0 = unset). */
export function parseNextElapse(value: string | undefined): string | null {
  if (!value) return null;
  const micros = Number(value);
  if (!Number.isFinite(micros) || micros <= 0) return null;
  return new Date(micros / 1000).toISOString();
}

function evaluateUnit(spec: SystemdUnitSpec, props: Record<string, string>): SystemdUnitStatus {
  const loadState = props.LoadState ?? "unknown";
  const activeState = props.ActiveState ?? "unknown";
  const subState = props.SubState ?? "unknown";
  const nextElapse = spec.kind === "timer" ? parseNextElapse(props.NextElapseUSecRealtime) : null;

  if (loadState === "not-found") {
    return {
      ...spec,
      loadState,
      activeState,
      subState,
      ok: false,
      severity: "unknown",
      nextElapse,
      message: "Unit nicht installiert",
    };
  }

  const active = activeState === "active";
  let severity: HostSeverity;
  let message: string;
  if (active) {
    severity = "ok";
    message = spec.kind === "timer" ? "Timer aktiv" : "Läuft";
  } else if (activeState === "failed" || subState === "failed") {
    severity = "error";
    message = "Fehlgeschlagen";
  } else {
    // A service that is not active is a real problem; a timer that is merely
    // inactive is a soft warning (may be disabled on purpose). Optional
    // services such as the RTX connector do not degrade the host ampel.
    severity = spec.optional ? "unknown" : spec.kind === "service" ? "error" : "warn";
    message = spec.optional
      ? `Optional, inaktiv (${activeState})`
      : `Inaktiv (${activeState})`;
  }

  return {
    ...spec,
    loadState,
    activeState,
    subState,
    ok: active,
    severity,
    nextElapse,
    message,
  };
}

function unavailable(spec: SystemdUnitSpec, message: string): SystemdUnitStatus {
  return {
    ...spec,
    loadState: "unknown",
    activeState: "unknown",
    subState: "unknown",
    ok: false,
    severity: "unknown",
    nextElapse: null,
    message,
  };
}

async function showUnit(
  run: CommandRunner,
  spec: SystemdUnitSpec,
): Promise<SystemdUnitStatus> {
  const args = ["show", spec.unit, ...SHOW_PROPERTIES.map((p) => `--property=${p}`)];
  const result = await run("systemctl", args);
  if (result == null) {
    return unavailable(spec, "systemctl nicht verfügbar");
  }
  const props = parseSystemctlShow(result.stdout);
  // systemctl present but systemd not running as PID 1 (e.g. container): it
  // exits non-zero with no property output. Degrade to unknown, not error.
  if (!props.LoadState && !props.ActiveState) {
    return unavailable(spec, "systemd nicht aktiv");
  }
  return evaluateUnit(spec, props);
}

/**
 * Read-only status of the UWE systemd units/timers. `systemctl show` needs no
 * root for state queries. When systemctl is missing (e.g. CI/container) every
 * unit degrades to `unknown` rather than erroring.
 */
export async function collectServiceStatus(
  options: { units?: SystemdUnitSpec[]; deps?: Partial<HostReadDeps> } = {},
): Promise<SystemdUnitStatus[]> {
  const { run } = resolveHostReadDeps(options.deps);
  const units = options.units ?? DEFAULT_UWE_UNITS;
  return Promise.all(units.map((spec) => showUnit(run, spec)));
}
