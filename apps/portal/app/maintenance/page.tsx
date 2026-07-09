import { getSystemSettingsSnapshot } from "@uwe/database/server";
import { MaintenanceRecoveryPoller } from "@uwe/shared-ui";

export default async function MaintenancePage() {
  const { settings } = await getSystemSettingsSnapshot();
  const message =
    settings.maintenance.message?.trim() ||
    "Das UWE Portal ist vorübergehend nicht verfügbar. Bitte später erneut versuchen.";

  return (
    <main className="uwe-page uwe-page-centered">
      <MaintenanceRecoveryPoller surface="portal" />
      <section className="uwe-card uwe-card-padded">
        <h1>Wartungsmodus</h1>
        <p>{message}</p>
        <p className="uwe-hint">
          Diese Seite prüft alle 30 Sekunden, ob der Wartungsmodus beendet wurde, und lädt dann
          automatisch neu.
        </p>
      </section>
    </main>
  );
}
