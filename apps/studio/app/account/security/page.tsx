import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AUDIT_ACTION_LABELS,
  createAuditLogService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { PasskeySettingsPanel } from "@/src/components/PasskeySettingsPanel";
import { TwoFactorSetupForm } from "@/src/components/TwoFactorSetupForm";
import { BreadcrumbTrail, SystemShell } from "@/src/components/shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { formatStudioDateTime } from "@/src/lib/format";

export default async function AccountSecurityPage() {
  const user = await getCurrentAuthUser();
  if (!user) {
    redirect("/login?redirect=/account/security");
  }

  const audit = createAuditLogService(prisma);
  const loginEvents = await audit.list({
    actorUserId: user.id,
    actions: ["login_success", "login_failed"],
    limit: 10,
  });
  const settings = await getAppRepository().getSystemSettings();

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Einstellungen", href: "/settings" },
            { label: "Sicherheit (2FA)" },
          ]}
        />
      }
    >
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Sicherheit</CardTitle>
          <CardDescription>
            Angemeldet als {user.displayName}
            {user.email ? ` (${user.email})` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSetupForm backHref="/account/password" />
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/account/password" className="text-primary hover:underline">
              Passwort ändern
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-md">
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>
            Anmeldung per Face ID, Touch ID, Fingerabdruck oder Sicherheitsschlüssel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasskeySettingsPanel
            enabled={settings.auth.passkeysEnabled}
            disabledHint="Passkey-Login ist deaktiviert. Aktiviere es unter Einstellungen → Anmeldung."
          />
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-2xl">
        <CardHeader>
          <CardTitle>Letzte Anmeldungen</CardTitle>
          <CardDescription>
            Erfolgreiche und fehlgeschlagene Login-Versuche für dieses Konto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loginEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Login-Ereignisse protokolliert.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">Zeit</th>
                  <th className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground">Ereignis</th>
                </tr>
              </thead>
              <tbody>
                {loginEvents.map((entry) => (
                  <tr key={entry.id}>
                    <td className="border-b border-border px-3 py-2">{formatStudioDateTime(entry.timestamp)}</td>
                    <td className="border-b border-border px-3 py-2">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </SystemShell>
  );
}
