import Link from "next/link";
import { SidebarSection } from "@uwe/shared-ui";
import { BackupWorkspace } from "@/components/BackupWorkspace";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { listStudioBackups } from "@/src/lib/backup-paths";

export default async function BackupPage() {
  const backups = await listStudioBackups();

  return (
    <StudioShell
      breadcrumb={<BreadcrumbTrail items={[{ label: "Backup & Restore" }]} />}
      contextPanel={
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
      <PageHeader
        title="Backup & Restore"
        summary="Erstelle vollständige oder welt-/kampagnenspezifische Backups, lade sie herunter und stelle Daten sicher wieder her."
      />
      <BackupWorkspace initialBackups={backups} />
    </StudioShell>
  );
}
