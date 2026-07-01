import { getSystemSettingsSnapshot } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";

export default async function MaintenancePage() {
  const { settings } = await getSystemSettingsSnapshot();
  const message =
    settings.maintenance.message?.trim() ||
    "UWE Studio ist vorübergehend nicht verfügbar. Bitte später erneut versuchen.";

  return (
    <SystemShell
      breadcrumb={<BreadcrumbTrail items={[{ label: "Wartungsmodus" }]} />}
    >
      <PageHeader title="Wartungsmodus" summary="Studio vorübergehend gesperrt" />
      <section className="uwe-card uwe-card-padded">
        <p>{message}</p>
        <p className="uwe-hint">
          Owner-Konten können Studio weiterhin nutzen, um den Notfallmodus in den{" "}
          <a href="/settings?tab=maintenance">Einstellungen</a> zu deaktivieren.
        </p>
      </section>
    </SystemShell>
  );
}
