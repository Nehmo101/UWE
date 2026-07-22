import { createLifeAdminService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";

export const dynamic = "force-dynamic";

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
    <BrainShell active="/hardware" title="Homelab & Hardware">
      <p>
        {devices.length} Gerät(e) — privates Homelab-Inventar. Netzwerk-/Gerätedaten bleiben lokal,
        nie in der Cloud.
      </p>
      {devices.length === 0 ? (
        <p>Keine Geräte erfasst.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0", display: "grid", gap: "0.6rem" }}>
          {devices.map((device) => (
            <li key={device.id} className="brain-row">
              <strong>{device.name}</strong>
              <span className="brain-tag">{device.status}</span>
              <span className="brain-muted">
                {" "}· {device.role}
                {device.hostname ? ` · ${device.hostname}` : ""}
                {device.ipAddress ? ` · ${device.ipAddress}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </BrainShell>
  );
}
