import Link from "next/link";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { listStoredBackups } from "@uwe/backup";
import { BackupWorkspace } from "@/components/BackupWorkspace";

export default async function BackupPage() {
  const backups = listStoredBackups();

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Backup & Restore" href="/" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Dashboard", href: "/" },
              { label: "Welten", href: "/worlds" },
              { label: "Backup", href: "/backup", active: true },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Backup" }]} />
          <PageHeader
            title="Backup & Restore"
            summary="Erstelle vollständige oder welt-/kampagnenspezifische Backups, lade sie herunter und stelle Daten sicher wieder her."
          />
          <BackupWorkspace initialBackups={backups} />
        </>
      }
      context={
        <SidebarSection title="Hinweise">
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
            <li style={{ marginBottom: "0.5rem" }}>ZIP-Backups enthalten JSON-Daten und Asset-Dateien.</li>
            <li style={{ marginBottom: "0.5rem" }}>Passwörter, Tokens und API-Keys werden ausgeschlossen.</li>
            <li>
              <Link href="/worlds">Welt-Backups auch pro Welt verfügbar</Link>
            </li>
          </ul>
        </SidebarSection>
      }
    />
  );
}
