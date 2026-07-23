import { createLifeAdminService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { createHardwareAction, deleteHardwareAction } from "../brain-actions";

export const dynamic = "force-dynamic";

const STATUS: Array<{ value: string; label: string }> = [
  { value: "active", label: "Aktiv" },
  { value: "planned", label: "Geplant" },
  { value: "offline", label: "Offline" },
  { value: "broken", label: "Defekt" },
  { value: "retired", label: "Ausgemustert" },
  { value: "archived", label: "Archiviert" },
];

export default async function BrainHardwarePage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/hardware" title="Hardware">
        <BrainDenied />
      </BrainShell>
    );
  }

  const devices = await createLifeAdminService(brainPrisma, prisma).listHardwareDevices();

  return (
    <BrainShell
      active="/hardware"
      title="Homelab & Hardware"
      lede={`${devices.length} Gerät(e) — privates Homelab-Inventar. Netzwerk- und Gerätedaten bleiben lokal.`}
    >
      <section className="brain-section">
        <h2>Neues Gerät</h2>
        <form action={createHardwareAction} className="brain-form brain-card">
          <label>
            Name
            <input name="name" required placeholder="z. B. Homeserver" />
          </label>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Rolle
              <input name="role" placeholder="z. B. NAS, Proxmox-Host" />
            </label>
            <label>
              Status
              <select name="status" defaultValue="active">
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Hostname
              <input name="hostname" placeholder="server.local" />
            </label>
            <label>
              Betriebssystem
              <input name="operatingSystem" placeholder="z. B. Debian 12" />
            </label>
          </div>
          <div>
            <button type="submit" className="brain-btn">
              Gerät anlegen
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Geräte · {devices.length}</h2>
        {devices.length === 0 ? (
          <p className="brain-muted">Keine Geräte erfasst.</p>
        ) : (
          <ul className="brain-list">
            {devices.map((device) => (
              <li key={device.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{device.name}</strong>
                  <span className="brain-tag">{device.status}</span>
                  <span className="brain-muted">
                    {device.role}
                    {device.hostname ? ` · ${device.hostname}` : ""}
                    {device.ipAddress ? ` · ${device.ipAddress}` : ""}
                  </span>
                  <form action={deleteHardwareAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={device.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
