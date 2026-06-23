import Link from "next/link";
import { SidebarSection } from "@uwe/shared-ui";
import { listStoredBackups } from "@uwe/backup";
import { BackupWorkspace } from "@/components/BackupWorkspace";
import { AdminModuleShell } from "@/components/AdminModuleShell";

export default async function BackupPage() {
  const backups = listStoredBackups();

  return (
    <AdminModuleShell
      activePath="/backup"
      title="Backup & Restore"
      summary="Erstelle vollständige oder welt-/kampagnenspezifische Backups, lade sie herunter und stelle Daten sicher wieder her."
      breadcrumbs={[{ label: "Dashboard", href: "/studio" }, { label: "Backup" }]}
      context={
        <SidebarSection title="Hinweise">
          <ul className="uwe-hint" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li style={{ marginBottom: "0.5rem" }}>ZIP-Backups enthalten JSON-Daten und Asset-Dateien.</li>
            <li style={{ marginBottom: "0.5rem" }}>Passwörter, Tokens und API-Keys werden ausgeschlossen.</li>
            <li>
              <Link href="/worlds">Welt-Backups auch pro Welt verfügbar</Link>
            </li>
          </ul>
        </SidebarSection>
      }
    >
      <BackupWorkspace initialBackups={backups} />
    </AdminModuleShell>
  );
}
