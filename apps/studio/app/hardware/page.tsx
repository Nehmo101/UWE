import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  createLifeAdminService,
  detectHardwareUrlWarnings,
  HardwareStatusEnum,
  prisma,
  HARDWARE_STATUS_LABELS,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import {
  createHardwareAction,
  deleteHardwareAction,
  toggleHardwareSetupStepAction,
  updateHardwareAction,
} from "../life-admin-actions";

export default async function HardwarePage() {
  const devices = await createLifeAdminService(prisma).listHardwareDevices({ limit: 200 });
  const urlWarnings = detectHardwareUrlWarnings(devices);

  return (
    <AdminModuleShell
      activePath="/hardware"
      title="Hardware / Homelab"
      summary="Geräte, Rollen, Setup-Schritte und Fehlernotizen für UWE Host, RTX und Infrastruktur."
    >
      {urlWarnings.length > 0 && (
        <section className="uwe-form-error uwe-section" role="alert">
          <strong>Sicherheitswarnungen:</strong>
          <ul>
            {urlWarnings.map((warning) => (
              <li key={`${warning.deviceId}-${warning.field}`}>
                {warning.deviceName}: {warning.message}
              </li>
            ))}
          </ul>
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
