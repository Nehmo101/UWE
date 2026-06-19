import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  countOpenSetupSteps,
  createLifeAdminService,
  detectHardwareUrlWarnings,
  extractHardwareRunbook,
  HardwareStatusEnum,
  prisma,
  HARDWARE_STATUS_LABELS,
  type HardwareStatus,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import {
  createHardwareAction,
  deleteHardwareAction,
  toggleHardwareSetupStepAction,
  updateHardwareAction,
} from "../life-admin-actions";

const HARDWARE_FILTERS = [
  { value: "all", label: "Alle" },
  { value: "active", label: "Aktiv" },
  { value: "issues", label: "Offline/Defekt" },
  { value: "planned", label: "Geplant" },
] as const;

type HardwareFilter = (typeof HARDWARE_FILTERS)[number]["value"];

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

function resolveFilter(raw: string | undefined): HardwareFilter {
  if (raw && HARDWARE_FILTERS.some((item) => item.value === raw)) {
    return raw as HardwareFilter;
  }
  return "all";
}

export default async function HardwarePage({ searchParams }: Props) {
  const { filter: filterRaw } = await searchParams;
  const filter = resolveFilter(filterRaw);
  const service = createLifeAdminService(prisma);

  const statusFilter: HardwareStatus | HardwareStatus[] | undefined =
    filter === "active"
      ? "active"
      : filter === "issues"
        ? (["offline", "broken"] as HardwareStatus[])
        : filter === "planned"
          ? "planned"
          : undefined;

  const [devices, filterCounts] = await Promise.all([
    service.listHardwareDevices({ status: statusFilter, limit: 200 }),
    service.getHardwareFilterCounts(),
  ]);

  const urlWarnings = detectHardwareUrlWarnings(devices);
  const openSetupSteps = devices.reduce(
    (sum, device) => sum + countOpenSetupSteps(device.setupSteps),
    0,
  );

  return (
    <AdminModuleShell
      activePath="/hardware"
      title="Hardware / Homelab"
      summary="Geräte, Runbooks, Setup-Schritte und Security-Hinweise für UWE Host, RTX und Infrastruktur."
    >
      <section className="uwe-today-attention" aria-label="Hardware-Filter">
        <div className="uwe-today-quick-chips">
          {HARDWARE_FILTERS.map((item) => {
            const count = filterCounts[item.value];
            const active = filter === item.value;
            return (
              <Link
                key={item.value}
                href={item.value === "all" ? "/hardware" : `/hardware?filter=${item.value}`}
                className="uwe-today-quick-chip"
                data-severity={active ? "warn" : "info"}
                aria-current={active ? "page" : undefined}
              >
                {item.label} ({count})
              </Link>
            );
          })}
        </div>
      </section>

      {(urlWarnings.length > 0 || openSetupSteps > 0) && (
        <section className="uwe-card uwe-section" role="status">
          <h2 className="uwe-section-title">Security & Setup</h2>
          {urlWarnings.length > 0 && (
            <div className="uwe-form-error">
              <strong>URL-Warnungen ({urlWarnings.length})</strong>
              <ul>
                {urlWarnings.map((warning) => (
                  <li key={`${warning.deviceId}-${warning.field}`}>
                    {warning.deviceName}: {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {openSetupSteps > 0 && (
            <p className="uwe-dashboard-muted">{openSetupSteps} offene Setup-Schritte in dieser Ansicht</p>
          )}
          <p>
            <Link href="/admin/status">Systemstatus & RTX Exposure →</Link>
          </p>
        </section>
      )}

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Neues Gerät</h2>
        <form action={createHardwareAction} className="uwe-brain-create-form">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Rolle
            <input name="role" placeholder="z. B. UWE Host, RTX-Rechner, Cloudflare" />
          </label>
          <label>
            Status
            <select name="status" defaultValue="planned">
              {Object.values(HardwareStatusEnum).map((status) => (
                <option key={status} value={status}>
                  {HARDWARE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hostname
            <input name="hostname" />
          </label>
          <label>
            IP (lokal)
            <input name="ipAddress" placeholder="192.168.x.x" />
          </label>
          <label>
            Lokale URL
            <input name="localUrl" placeholder="http://192.168.x.x:3000" />
          </label>
          <label>
            Öffentliche URL (nur wenn bewusst — Warnung bei RTX)
            <input name="publicUrl" />
          </label>
          <label>
            Betriebssystem
            <input name="operatingSystem" />
          </label>
          <label>
            Setup-Schritte (eine Zeile pro Schritt)
            <textarea name="setupSteps" rows={3} />
          </label>
          <label>
            Runbook (Wartung, Neustart, Backup-Schritte)
            <textarea name="runbook" rows={4} placeholder="1. SSH …&#10;2. systemctl restart …" />
          </label>
          <label>
            Fehlernotizen
            <textarea name="errorNotes" rows={2} />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <button type="submit" className="uwe-btn uwe-btn-primary">
            Gerät anlegen
          </button>
        </form>
      </section>

      <section className="uwe-section">
        <h2 className="uwe-section-title">Geräte ({devices.length})</h2>
        {devices.length === 0 ? (
          <EmptyState
            title="Noch keine Geräte"
            description="Dokumentiere Homelab- und UWE-Infrastruktur hier."
            action={<Link href="/capture">Capture öffnen</Link>}
          />
        ) : (
          <div className="uwe-today-card-list">
            {devices.map((device) => (
              <article key={device.id} className="uwe-today-card">
                <form action={updateHardwareAction} className="uwe-brain-create-form">
                  <input type="hidden" name="id" value={device.id} />
                  <label>
                    Name
                    <input name="name" defaultValue={device.name} required />
                  </label>
                  <label>
                    Rolle
                    <input name="role" defaultValue={device.role} />
                  </label>
                  <label>
                    Status
                    <select name="status" defaultValue={device.status}>
                      {Object.values(HardwareStatusEnum).map((status) => (
                        <option key={status} value={status}>
                          {HARDWARE_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    IP
                    <input name="ipAddress" defaultValue={device.ipAddress ?? ""} />
                  </label>
                  <label>
                    Lokale URL
                    <input name="localUrl" defaultValue={device.localUrl ?? ""} />
                  </label>
                  <label>
                    Öffentliche URL
                    <input name="publicUrl" defaultValue={device.publicUrl ?? ""} />
                  </label>
                  <label>
                    Runbook
                    <textarea
                      name="runbook"
                      rows={4}
                      defaultValue={extractHardwareRunbook(device.metadata)}
                    />
                  </label>
                  <label>
                    Fehlernotizen
                    <textarea name="errorNotes" rows={2} defaultValue={device.errorNotes ?? ""} />
                  </label>
                  <label>
                    Notizen
                    <textarea name="notes" rows={2} defaultValue={device.notes} />
                  </label>
                  <p className="uwe-dashboard-muted">
                    {device.role || "—"} · {HARDWARE_STATUS_LABELS[device.status]}
                    {device.operatingSystem ? ` · ${device.operatingSystem}` : ""}
                    {device.localUrl ? (
                      <>
                        {" "}
                        · <a href={device.localUrl}>{device.localUrl}</a>
                      </>
                    ) : null}
                  </p>
                  {Array.isArray(device.setupSteps) && device.setupSteps.length > 0 && (
                    <ul className="uwe-today-card-list">
                      {device.setupSteps.map((step, index) => {
                        const label =
                          typeof step === "string"
                            ? step
                            : (step as { label?: string }).label ?? "";
                        const done =
                          typeof step === "object" &&
                          step !== null &&
                          "done" in step &&
                          Boolean((step as { done?: boolean }).done);
                        return (
                          <li key={`${device.id}-step-${index}`}>
                            <form action={toggleHardwareSetupStepAction} style={{ display: "inline" }}>
                              <input type="hidden" name="deviceId" value={device.id} />
                              <input type="hidden" name="stepIndex" value={index} />
                              <button type="submit" className="uwe-btn uwe-btn-ghost uwe-btn-sm">
                                {done ? "☑" : "☐"} {label}
                              </button>
                            </form>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                    Speichern
                  </button>
                </form>
                <form action={deleteHardwareAction}>
                  <input type="hidden" name="id" value={device.id} />
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                    Löschen
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="uwe-dashboard-muted">
        RTX-/Systemstatus: <Link href="/admin/status">Admin Status Dashboard →</Link>
      </p>
    </AdminModuleShell>
  );
}
