import { getSystemSettingsSnapshot } from "@uwe/database/server";
import { MaintenanceRecoveryPoller } from "@uwe/shared-ui";
import { PageHeader } from "@/src/components/shell";
import { commandCenterHint } from "@/src/lib/command-center-hint";

/**
 * Wartungsmodus — bewusst ohne Shell (siehe `studio-chrome.ts`): die Seite ist
 * ohne Anmeldung erreichbar, und solange der Modus läuft, führt jedes
 * Navigationsziel hierher zurück. Eine vollständige Seitenleiste böte
 * ausschließlich Sackgassen an. Das Layout bringt die Seite deshalb selbst mit.
 */
export default async function MaintenancePage() {
  const { settings } = await getSystemSettingsSnapshot();
  const message =
    settings.maintenance.message?.trim() ||
    "UWE Studio ist vorübergehend nicht verfügbar. Bitte später erneut versuchen.";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-10 md:px-6">
      <MaintenanceRecoveryPoller surface="studio" />
      <PageHeader title="Wartungsmodus" summary="Studio vorübergehend gesperrt" />
      <section className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm flex flex-col gap-2">
        <p>{message}</p>
        <p className="text-sm text-muted-foreground">
          Diese Seite prüft alle 30 Sekunden, ob der Wartungsmodus beendet wurde, und lädt dann
          automatisch neu.
        </p>
        <p className="text-sm text-muted-foreground">
          Owner-Konten können Studio weiterhin nutzen. {commandCenterHint("Notfallmodus")}
        </p>
      </section>
    </main>
  );
}
