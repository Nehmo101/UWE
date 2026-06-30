import { getSystemSettingsSnapshot } from "@uwe/database/server";

export default async function MaintenancePage() {
  const { settings } = await getSystemSettingsSnapshot();
  const message =
    settings.maintenance.message?.trim() ||
    "Das UWE Portal ist vorübergehend nicht verfügbar. Bitte später erneut versuchen.";

  return (
    <main className="uwe-page uwe-page-centered">
      <section className="uwe-card uwe-card-padded">
        <h1>Wartungsmodus</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}
