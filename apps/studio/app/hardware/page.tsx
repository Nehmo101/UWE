import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  HardwareStatusEnum,
  HARDWARE_STATUS_LABELS,
  prisma,
} from "@uwe/database/server";
import { AdminCreateCard, AdminEntityForm, AdminModulePage, BreadcrumbTrail } from "@/src/components/admin";
import { SystemHubBanner } from "@/components/SystemHubBanner";
import { HostUpdatePanel } from "@/components/HostUpdatePanel";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { formatStudioDateTime } from "@/src/lib/format";
import {
  addHardwareErrorAction,
  createHardwareAction,
  deleteHardwareAction,
  recordHardwareCheckAction,
  toggleHardwareSetupStepAction,
  updateHardwareAction,
} from "../life-admin-actions";
import { getHomelabCockpitData } from "@/src/lib/homelab-dashboard";
import { AutoRefreshPanel } from "@/src/components/ux/AutoRefreshPanel";

function severityStatus(severity: string, ok: boolean): "ok" | "warn" | "error" {
  if (severity === "ok" || ok) return "ok";
  if (severity === "warn" || severity === "unknown") return "warn";
  return "error";
}

function statusBadgeClass(status: string): string {
  if (status === "active") return "uwe-hw-badge-active";
  if (status === "offline" || status === "broken") return "uwe-hw-badge-error";
  if (status === "planned") return "uwe-hw-badge-planned";
  return "uwe-hw-badge-neutral";
}

export default async function HardwarePage() {
  const [cockpit, user] = await Promise.all([
    getHomelabCockpitData(prisma),
    getCurrentAuthUser(),
  ]);
  const canTriggerHostUpdate = user?.role === "owner";

  return (
    <AdminModulePage
      breadcrumb={<BreadcrumbTrail items={[{ label: "Hardware / Homelab" }]} />}
      title="Hardware / Homelab"
      summary="Kontrollzentrum für Host, RTX, Cloudflare, Dienste, Runbooks und Security."
    >
      <SystemHubBanner />
      <HostUpdatePanel canTrigger={canTriggerHostUpdate} />

      {cockpit.urlWarnings.length > 0 && (
        <section className="uwe-form-error uwe-v2-section" role="alert">
          <strong>Sicherheitswarnungen (RTX niemals öffentlich):</strong>
          <ul>
            {cockpit.urlWarnings.map((warning) => (
              <li key={`${warning.deviceId}-${warning.field}`}>
                {warning.deviceName}: {warning.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <AutoRefreshPanel intervalMs={30_000} label="Service-Status wird alle 30 Sekunden aktualisiert.">
      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Service-Status</h2>
        <p className="uwe-dashboard-muted">
          Stand: {formatStudioDateTime(cockpit.timestamp)} ·{" "}
          <Link href="/system?tab=diagnose">System-Diagnose →</Link>
        </p>
        <div className="uwe-homelab-service-grid">
          {cockpit.serviceStatuses.map((service) => (
            <article
              key={service.id}
              className="uwe-homelab-service-card"
              data-status={severityStatus(service.severity, service.ok)}
            >
              <h3>{service.label}</h3>
              <p>{service.message}</p>
            </article>
          ))}
        </div>
      </section>
      </AutoRefreshPanel>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Security Checklist</h2>
        <ul className="uwe-homelab-checklist">
          {cockpit.securityChecks.map((check) => (
            <li key={check.id} data-status={severityStatus(check.severity, check.ok)}>
              <strong>{check.label}</strong>
              {check.manual ? " (manuell)" : ""}
              <span>{check.message}</span>
            </li>
          ))}
        </ul>
        <p className="uwe-dashboard-muted">
          Details: <Link href="/admin/security">Security Dashboard →</Link>
        </p>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Runbooks</h2>
        <div className="uwe-homelab-runbook-list">
          {cockpit.runbooks.map((runbook) => (
            <details key={runbook.id} className="uwe-v2-card uwe-v2-card-padded uwe-homelab-runbook">
              <summary>
                <strong>{runbook.title}</strong> — {runbook.summary}
              </summary>
              <ol>
                {runbook.steps.map((step) => (
                  <li key={`${runbook.id}-${step.order}`}>
                    {step.instruction}
                    {step.command ? (
                      <code className="uwe-homelab-command">{step.command}</code>
                    ) : null}
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Fehlerhistorie</h2>
        {cockpit.errorHistory.length === 0 ? (
          <p className="uwe-dashboard-muted">Noch keine dokumentierten Fehler.</p>
        ) : (
          <div className="uwe-today-card-list">
            {cockpit.errorHistory.slice(0, 20).map((entry) => (
              <article key={`${entry.deviceId}-${entry.id}`} className="uwe-today-card">
                <h3>{entry.problem}</h3>
                <p>
                  {entry.deviceName} · {formatStudioDateTime(entry.occurredAt)}
                </p>
                {entry.affectedServices && entry.affectedServices.length > 0 ? (
                  <p className="uwe-dashboard-muted">
                    Services: {entry.affectedServices.join(", ")}
                  </p>
                ) : null}
                {entry.resolution ? <p>Lösung: {entry.resolution}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <AdminCreateCard title="Neues Gerät">
        <AdminEntityForm
          action={createHardwareAction}
          submitLabel="Gerät anlegen"
          fields={[
            { name: "name", label: "Name", required: true },
            {
              name: "role",
              label: "Rolle",
              placeholder: "z. B. UWE Host, RTX-Rechner, Cloudflare",
            },
            {
              name: "status",
              label: "Status",
              type: "select",
              defaultValue: "planned",
              options: Object.values(HardwareStatusEnum).map((status) => ({
                value: status,
                label: HARDWARE_STATUS_LABELS[status],
              })),
            },
            { name: "hostname", label: "Hostname" },
            { name: "ipAddress", label: "IP (lokal)", placeholder: "192.168.x.x" },
            { name: "localUrl", label: "Lokale URL", placeholder: "http://192.168.x.x:3000" },
            {
              name: "publicUrl",
              label: "Öffentliche URL (nur UWE Host — nie RTX/Ollama)",
            },
            { name: "operatingSystem", label: "Betriebssystem" },
            {
              name: "specs",
              label: "Specs (eine Zeile pro Eintrag)",
              type: "textarea",
              rows: 2,
              placeholder: "CPU: …\nRAM: 32 GB",
            },
            {
              name: "services",
              label: "Dienste (eine Zeile pro Dienst)",
              type: "textarea",
              rows: 2,
              placeholder: "UWE Studio\nPostgreSQL",
            },
            {
              name: "setupSteps",
              label: "Setup-Schritte (eine Zeile pro Schritt)",
              type: "textarea",
              rows: 3,
            },
            { name: "errorNotes", label: "Fehlernotizen", type: "textarea", rows: 2 },
            { name: "notes", label: "Notizen", type: "textarea", rows: 2 },
          ]}
        />
      </AdminCreateCard>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Geräte ({cockpit.deviceCards.length})</h2>
        {cockpit.deviceCards.length === 0 ? (
          <EmptyState
            title="Noch keine Geräte"
            description="Dokumentiere Homelab- und UWE-Infrastruktur hier."
            action={<Link href="/capture">Capture öffnen</Link>}
          />
        ) : (
          <div className="uwe-homelab-device-grid">
            {cockpit.deviceCards.map((device) => {
              const deviceWarnings = cockpit.urlWarnings.filter((w) => w.deviceId === device.id);
              return (
                <article key={device.id} className="uwe-v2-card uwe-v2-card-padded uwe-homelab-device-card">
                  <header className="uwe-homelab-device-header">
                    <div>
                      <h3>{device.name}</h3>
                      <p className="uwe-dashboard-muted">{device.role || "—"}</p>
                    </div>
                    <span className={`uwe-hw-badge ${statusBadgeClass(device.status)}`}>
                      {HARDWARE_STATUS_LABELS[device.status as keyof typeof HARDWARE_STATUS_LABELS] ??
                        device.status}
                    </span>
                  </header>

                  <dl className="uwe-homelab-device-meta">
                    <div>
                      <dt>Hostname</dt>
                      <dd>{device.hostname || "—"}</dd>
                    </div>
                    <div>
                      <dt>Lokale IP</dt>
                      <dd>{device.ipAddress || "—"}</dd>
                    </div>
                    <div>
                      <dt>OS</dt>
                      <dd>{device.operatingSystem || "—"}</dd>
                    </div>
                    <div>
                      <dt>Letzte Prüfung</dt>
                      <dd>
                        {device.lastCheckedAt
                          ? formatStudioDateTime(device.lastCheckedAt)
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  {(device.localUrl || device.publicUrl) && (
                    <p className="uwe-homelab-urls">
                      {device.localUrl ? (
                        <>
                          Lokal:{" "}
                          <a href={device.localUrl} target="_blank" rel="noreferrer">
                            {device.localUrl}
                          </a>
                        </>
                      ) : null}
                      {device.publicUrl ? (
                        <>
                          {" "}
                          · Öffentlich:{" "}
                          <a href={device.publicUrl} target="_blank" rel="noreferrer">
                            {device.publicUrl}
                          </a>
                        </>
                      ) : null}
                    </p>
                  )}

                  {device.specsLines.length > 0 && (
                    <ul className="uwe-homelab-specs">
                      {device.specsLines.map((line) => (
                        <li key={`${device.id}-spec-${line}`}>{line}</li>
                      ))}
                    </ul>
                  )}

                  {device.services.length > 0 && (
                    <p className="uwe-dashboard-muted">
                      Dienste: {device.services.join(" · ")}
                    </p>
                  )}

                  {deviceWarnings.length > 0 && (
                    <ul className="uwe-form-error">
                      {deviceWarnings.map((warning) => (
                        <li key={`${warning.field}-${warning.url}`}>{warning.message}</li>
                      ))}
                    </ul>
                  )}

                  {device.openSetupSteps > 0 && (
                    <p className="uwe-dashboard-muted">
                      {device.openSetupSteps} offene Setup-Schritte
                    </p>
                  )}

                  {device.setupSteps.length > 0 && (
                    <ul className="uwe-today-card-list">
                      {device.setupSteps.map((step, index) => (
                        <li key={`${device.id}-step-${index}`}>
                          <form action={toggleHardwareSetupStepAction} style={{ display: "inline" }}>
                            <input type="hidden" name="deviceId" value={device.id} />
                            <input type="hidden" name="stepIndex" value={index} />
                            <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                              {step.done ? "☑" : "☐"} {step.label}
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form action={updateHardwareAction} className="uwe-brain-create-form uwe-homelab-edit-form">
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
                      Hostname
                      <input name="hostname" defaultValue={device.hostname ?? ""} />
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
                      Betriebssystem
                      <input name="operatingSystem" defaultValue={device.operatingSystem} />
                    </label>
                    <label>
                      Specs
                      <textarea
                        name="specs"
                        rows={2}
                        defaultValue={device.specsLines.join("\n")}
                      />
                    </label>
                    <label>
                      Dienste
                      <textarea
                        name="services"
                        rows={2}
                        defaultValue={device.services.join("\n")}
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
                    <div className="uwe-homelab-device-actions">
                      <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                        Speichern
                      </button>
                    </div>
                  </form>

                  <form action={recordHardwareCheckAction} style={{ display: "inline" }}>
                    <input type="hidden" name="deviceId" value={device.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                      Jetzt geprüft
                    </button>
                  </form>

                  <form action={addHardwareErrorAction} className="uwe-brain-create-form uwe-homelab-error-form">
                    <input type="hidden" name="deviceId" value={device.id} />
                    <label>
                      Fehler protokollieren
                      <input name="problem" placeholder="Problem" required />
                    </label>
                    <label>
                      Lösung
                      <input name="resolution" placeholder="Optional" />
                    </label>
                    <label>
                      Betroffene Services
                      <input name="affectedServices" placeholder="rtx_agent, backup" />
                    </label>
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                      Fehler speichern
                    </button>
                  </form>

                  <form action={deleteHardwareAction}>
                    <input type="hidden" name="id" value={device.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                      Löschen
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminModulePage>
  );
}
