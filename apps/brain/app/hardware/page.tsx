import { HardwareStatusEnum, HARDWARE_STATUS_LABELS, prisma } from "@uwe/database/server";
import { getHomelabCockpitData } from "@uwe/host-cockpit";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  addHardwareErrorAction,
  createHardwareAction,
  deleteHardwareAction,
  recordHardwareCheckAction,
  toggleHardwareSetupStepAction,
  updateHardwareAction,
} from "../hardware-actions";

/**
 * Homelab & Hardware — Geräteinventar mit Setup-Schritten, Prüfungen und
 * Fehlerhistorie.
 *
 * Die Seite gab es doppelt, in Studio und in Brain (Abschnitt H8). Brain
 * gewinnt; der Funktionsumfang der Studio-Fassung ist hier nachgezogen. Der
 * Betriebsblick auf Dienste, Security und Runbooks liegt nebenan unter
 * `/system` — hier geht es um die Geräte selbst.
 */

export const dynamic = "force-dynamic";

const DATE_TIME = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME.format(date);
}

/** Nur „läuft" vs. „läuft nicht" — Brain kennt keine dritte Farbe. */
function statusOk(status: string): boolean {
  return status !== "offline" && status !== "broken";
}

const STATUS_OPTIONS = Object.values(HardwareStatusEnum).map((status) => ({
  value: status,
  label: HARDWARE_STATUS_LABELS[status] ?? status,
}));

function StatusSelect({ id, defaultValue }: { id?: string; defaultValue: string }) {
  return (
    <label>
      Status
      <select id={id} name="status" defaultValue={defaultValue}>
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function BrainHardwarePage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/hardware" title="Hardware">
        <BrainDenied />
      </BrainShell>
    );
  }

  const cockpit = await getHomelabCockpitData(prisma);
  const openSteps = cockpit.deviceCards.reduce((total, device) => total + device.openSetupSteps, 0);
  const offline = cockpit.deviceCards.filter((device) => !statusOk(device.status)).length;

  return (
    <BrainShell
      active="/hardware"
      title="Homelab & Hardware"
      lede={`${cockpit.deviceCards.length} Gerät(e) — privates Inventar. Netzwerk- und Gerätedaten bleiben lokal.`}
    >
      {cockpit.urlWarnings.length > 0 ? (
        <div className="brain-callout brain-callout-warn" role="alert">
          <strong>Sicherheitswarnungen — der RTX-Host gehört nie ins öffentliche Netz:</strong>
          <ul>
            {cockpit.urlWarnings.map((warning) => (
              <li key={`${warning.deviceId}-${warning.field}`}>
                {warning.deviceName}: {warning.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="brain-kpis">
        <div className="brain-kpi">
          <strong>{cockpit.deviceCards.length}</strong>
          <span>Geräte</span>
        </div>
        <div className="brain-kpi">
          <strong>{offline}</strong>
          <span>offline / defekt</span>
        </div>
        <div className="brain-kpi">
          <strong>{openSteps}</strong>
          <span>offene Setup-Schritte</span>
        </div>
        <div className="brain-kpi">
          <strong>{cockpit.errorHistory.length}</strong>
          <span>dokumentierte Fehler</span>
        </div>
      </div>

      <section className="brain-section">
        <h2>Neues Gerät</h2>
        <form action={createHardwareAction} className="brain-form brain-card">
          <div className="brain-form-row">
            <label>
              Name
              <input name="name" required placeholder="z. B. Homeserver" />
            </label>
            <label>
              Rolle
              <input name="role" placeholder="z. B. UWE Host, RTX-Rechner, NAS" />
            </label>
            <StatusSelect defaultValue="planned" />
          </div>
          <div className="brain-form-row">
            <label>
              Hostname
              <input name="hostname" placeholder="server.local" />
            </label>
            <label>
              IP (lokal)
              <input name="ipAddress" placeholder="192.168.x.x" />
            </label>
            <label>
              Betriebssystem
              <input name="operatingSystem" placeholder="z. B. Debian 12" />
            </label>
          </div>
          <div className="brain-form-row">
            <label>
              Lokale URL
              <input name="localUrl" placeholder="http://192.168.x.x:3000" />
            </label>
            <label>
              Öffentliche URL (nur UWE-Host — nie RTX/Ollama)
              <input name="publicUrl" />
            </label>
          </div>
          <label>
            Specs (eine Zeile pro Eintrag)
            <textarea name="specs" rows={2} placeholder={"CPU: …\nRAM: 32 GB"} />
          </label>
          <label>
            Dienste (eine Zeile pro Dienst)
            <textarea name="services" rows={2} placeholder={"UWE Studio\nPostgreSQL"} />
          </label>
          <label>
            Setup-Schritte (eine Zeile pro Schritt)
            <textarea name="setupSteps" rows={3} />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <div>
            <button type="submit" className="brain-btn">
              Gerät anlegen
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Geräte · {cockpit.deviceCards.length}</h2>
        {cockpit.deviceCards.length === 0 ? (
          <p className="brain-muted">
            Noch keine Geräte erfasst. Dokumentiere hier Homelab- und UWE-Infrastruktur.
          </p>
        ) : (
          <ul className="brain-list">
            {cockpit.deviceCards.map((device) => {
              const warnings = cockpit.urlWarnings.filter((entry) => entry.deviceId === device.id);
              const statusLabel =
                HARDWARE_STATUS_LABELS[device.status as keyof typeof HARDWARE_STATUS_LABELS] ??
                device.status;

              return (
                <li key={device.id} className="brain-row">
                  <div className="brain-row-head">
                    <strong>{device.name}</strong>
                    <span className={statusOk(device.status) ? "brain-tag" : "brain-tag brain-tag-warn"}>
                      {statusLabel}
                    </span>
                    <span className="brain-muted">
                      {device.role || "—"}
                      {device.hostname ? ` · ${device.hostname}` : ""}
                      {device.ipAddress ? ` · ${device.ipAddress}` : ""}
                      {device.operatingSystem ? ` · ${device.operatingSystem}` : ""}
                    </span>
                    <form action={recordHardwareCheckAction} style={{ marginLeft: "auto" }}>
                      <input type="hidden" name="deviceId" value={device.id} />
                      <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                        Jetzt geprüft
                      </button>
                    </form>
                  </div>

                  <p className="brain-muted">Letzte Prüfung: {formatDateTime(device.lastCheckedAt)}</p>

                  {device.localUrl || device.publicUrl ? (
                    <p className="brain-muted" style={{ wordBreak: "break-all" }}>
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
                          {device.localUrl ? " · " : ""}Öffentlich:{" "}
                          <a href={device.publicUrl} target="_blank" rel="noreferrer">
                            {device.publicUrl}
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}

                  {warnings.length > 0 ? (
                    <ul role="alert" className="brain-callout brain-callout-warn">
                      {warnings.map((warning) => (
                        <li key={`${warning.field}-${warning.url}`}>{warning.message}</li>
                      ))}
                    </ul>
                  ) : null}

                  {device.specsLines.length > 0 ? (
                    <p className="brain-muted">Specs: {device.specsLines.join(" · ")}</p>
                  ) : null}
                  {device.services.length > 0 ? (
                    <p className="brain-muted">Dienste: {device.services.join(" · ")}</p>
                  ) : null}

                  {device.setupSteps.length > 0 ? (
                    <details className="brain-edit" open={device.openSetupSteps > 0}>
                      <summary>
                        Setup-Schritte
                        {device.openSetupSteps > 0
                          ? ` · ${device.openSetupSteps} offen`
                          : " · alle erledigt"}
                      </summary>
                      <ul className="brain-list">
                        {device.setupSteps.map((step, index) => (
                          <li key={`${device.id}-step-${index}`}>
                            <form action={toggleHardwareSetupStepAction}>
                              <input type="hidden" name="deviceId" value={device.id} />
                              <input type="hidden" name="stepIndex" value={index} />
                              <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                                {step.done ? "☑" : "☐"} {step.label}
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}

                  <details className="brain-edit">
                    <summary>Fehler melden</summary>
                    <form action={addHardwareErrorAction} className="brain-form">
                      <input type="hidden" name="deviceId" value={device.id} />
                      <label>
                        Problem
                        <input name="problem" required />
                      </label>
                      <label>
                        Lösung (optional)
                        <input name="resolution" />
                      </label>
                      <label>
                        Betroffene Dienste (kommagetrennt)
                        <input name="affectedServices" placeholder="rtx_agent, backup" />
                      </label>
                      <div>
                        <button type="submit" className="brain-btn brain-btn-sm">
                          Fehler speichern
                        </button>
                      </div>
                    </form>
                  </details>

                  <details className="brain-edit">
                    <summary>Bearbeiten</summary>
                    <form action={updateHardwareAction} className="brain-form">
                      <input type="hidden" name="id" value={device.id} />
                      <div className="brain-form-row">
                        <label>
                          Name
                          <input name="name" defaultValue={device.name} required />
                        </label>
                        <label>
                          Rolle
                          <input name="role" defaultValue={device.role} />
                        </label>
                        <StatusSelect defaultValue={device.status} />
                      </div>
                      <div className="brain-form-row">
                        <label>
                          Hostname
                          <input name="hostname" defaultValue={device.hostname ?? ""} />
                        </label>
                        <label>
                          IP
                          <input name="ipAddress" defaultValue={device.ipAddress ?? ""} />
                        </label>
                        <label>
                          Betriebssystem
                          <input name="operatingSystem" defaultValue={device.operatingSystem} />
                        </label>
                      </div>
                      <div className="brain-form-row">
                        <label>
                          Lokale URL
                          <input name="localUrl" defaultValue={device.localUrl ?? ""} />
                        </label>
                        <label>
                          Öffentliche URL
                          <input name="publicUrl" defaultValue={device.publicUrl ?? ""} />
                        </label>
                      </div>
                      <label>
                        Specs
                        <textarea name="specs" rows={2} defaultValue={device.specsLines.join("\n")} />
                      </label>
                      <label>
                        Dienste
                        <textarea name="services" rows={2} defaultValue={device.services.join("\n")} />
                      </label>
                      <label>
                        Fehlernotizen
                        <textarea name="errorNotes" rows={2} defaultValue={device.errorNotes ?? ""} />
                      </label>
                      <label>
                        Notizen
                        <textarea name="notes" rows={2} defaultValue={device.notes} />
                      </label>
                      <div>
                        <button type="submit" className="brain-btn brain-btn-sm">
                          Speichern
                        </button>
                      </div>
                    </form>

                    <form action={deleteHardwareAction}>
                      <input type="hidden" name="id" value={device.id} />
                      <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                        Gerät löschen
                      </button>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="brain-section">
        <h2>Fehlerhistorie</h2>
        {cockpit.errorHistory.length === 0 ? (
          <p className="brain-muted">Noch keine dokumentierten Fehler.</p>
        ) : (
          <ul className="brain-list">
            {cockpit.errorHistory.slice(0, 20).map((entry) => (
              <li key={`${entry.deviceId}-${entry.id}`} className="brain-row">
                <div className="brain-row-head">
                  <strong>{entry.problem}</strong>
                  <span className="brain-muted">
                    {entry.deviceName} · {formatDateTime(entry.occurredAt)}
                  </span>
                </div>
                {entry.affectedServices && entry.affectedServices.length > 0 ? (
                  <p className="brain-muted">Dienste: {entry.affectedServices.join(", ")}</p>
                ) : null}
                {entry.resolution ? <p>Lösung: {entry.resolution}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
