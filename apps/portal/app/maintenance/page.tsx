import { getSystemSettingsSnapshot } from "@uwe/database/server";
import { MaintenanceRecoveryPoller } from "@uwe/shared-ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

export default async function MaintenancePage() {
  const { settings } = await getSystemSettingsSnapshot();
  const message =
    settings.maintenance.message?.trim() ||
    "Das UWE Portal ist vorübergehend nicht verfügbar. Bitte später erneut versuchen.";

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <MaintenanceRecoveryPoller surface="portal" />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Wartungsmodus</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Diese Seite prüft alle 30 Sekunden, ob der Wartungsmodus beendet wurde, und lädt dann
            automatisch neu.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
