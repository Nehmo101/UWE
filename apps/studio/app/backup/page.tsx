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
          <ul className="flex list-none flex-col gap-2 text-sm text-muted-foreground">
            <li>ZIP-Backups enthalten JSON-Daten und Asset-Dateien.</li>
            <li>Passwörter, Tokens und API-Keys werden ausgeschlossen.</li>
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
