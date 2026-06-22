import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  HardwareStatusEnum,
  HARDWARE_STATUS_LABELS,
  prisma,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import { HostUpdatePanel } from "@/components/HostUpdatePanel";
import { getCurrentAuthUser } from "@/src/lib/auth";
import {
  addHardwareErrorAction,
  createHardwareAction,
  deleteHardwareAction,
  recordHardwareCheckAction,
  toggleHardwareSetupStepAction,
  updateHardwareAction,
} from "../life-admin-actions";
import { getHomelabCockpitData } from "@/src/lib/homelab-dashboard";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
    <AdminModuleShell
      activePath="/hardware"
      title="Hardware / Homelab"
      summary="Kontrollzentrum für Host, RTX, Cloudflare, Dienste, Runbooks und Security."
    >
      <HostUpdatePanel canTrigger={canTriggerHostUpdate} />

      {cockpit.urlWarnings.length > 0 && (
        <section className="uwe-form-error uwe-section" role="alert">
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

      <section className="uwe-section">
        <h2 className="uwe-section-title">Service-Status</h2>
        <p className="uwe-dashboard-muted">
          Stand: {DATE_FORMAT.format(new Date(cockpit.timestamp))} ·{" "}
          <Link href="/admin/status">Admin Status →</Link>
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

      <section className="uwe-section">
        <h2 className="uwe-section-title">Security Checklist</h2>
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

      <section className="uwe-section">
        <h2 className="uwe-section-title">Runbooks</h2>
        <div className="uwe-homelab-runbook-list">
          {cockpit.runbooks.map((runbook) => (
            <details key={runbook.id} className="uwe-card uwe-homelab-runbook">
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

      <section className="uwe-section">
        <h2 className="uwe-section-title">Fehlerhistorie</h2>
        {cockpit.errorHistory.length === 0 ? (
          <p className="uwe-dashboard-muted">Noch keine dokumentierten Fehler.</p>
        ) : (
          <div className="uwe-today-card-list">
            {cockpit.errorHistory.slice(0, 20).map((entry) => (
              <article key={`${entry.deviceId}-${entry.id}`} className="uwe-today-card">
                <h3>{entry.problem}</h3>
                <p>
                  {entry.deviceName} · {DATE_FORMAT.format(new Date(entry.occurredAt))}
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
            Öffentliche URL (nur UWE Host — nie RTX/Ollama)
            <input name="publicUrl" />
          </label>
          <label>
            Betriebssystem
            <input name="operatingSystem" />
          </label>
          <label>
            Specs (eine Zeile pro Eintrag)
            <textarea name="specs" rows={2} placeholder="CPU: …&#10;RAM: 32 GB" />
          </label>
          <label>
            Dienste (eine Zeile pro Dienst)
            <textarea name="services" rows={2} placeholder="UWE Studio&#10;PostgreSQL" />
          </label>
          <label>
            Setup-Schritte (eine Zeile pro Schritt)
            <textarea name="setupSteps" rows={3} />
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
        <h2 className="uwe-section-title">Geräte ({cockpit.deviceCards.length})</h2>
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
                <article key={device.id} className="uwe-card uwe-homelab-device-card">
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
                          ? DATE_FORMAT.format(new Date(device.lastCheckedAt))
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
                            <button type="submit" className="uwe-btn uwe-btn-ghost uwe-btn-sm">
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
                      <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                        Speichern
                      </button>
                    </div>
                  </form>

                  <form action={recordHardwareCheckAction} style={{ display: "inline" }}>
                    <input type="hidden" name="deviceId" value={device.id} />
                    <button type="submit" className="uwe-btn uwe-btn-ghost uwe-btn-sm">
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
                    <button type="submit" className="uwe-btn uwe-btn-ghost uwe-btn-sm">
                      Fehler speichern
                    </button>
                  </form>

                  <form action={deleteHardwareAction}>
                    <input type="hidden" name="id" value={device.id} />
                    <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                      Löschen
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminModuleShell>
  );
}
