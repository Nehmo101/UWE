import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AUDIT_ACTION_LABELS,
  createAuditLogService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { createAuthIdentityService } from "@uwe/database/auth-identities";
import { ResponsiveTable } from "@uwe/shared-ui";
import { resolveLoginMethodsPublicConfig } from "@uwe/database/login-methods-settings";
import { GoogleAccountLinkCard } from "@/src/components/GoogleAccountLinkCard";
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
import { commandCenterHint } from "@/src/lib/command-center-hint";
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
  const loginMethods = resolveLoginMethodsPublicConfig(settings.auth);
  const identities = await createAuthIdentityService(prisma).listForUser(user.id);
  const googleIdentity = identities.find((identity) => identity.provider === "google") ?? null;

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
            disabledHint={`Passkey-Login ist deaktiviert. ${commandCenterHint("Anmeldung")}`}
          />
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-md">
        <CardHeader>
          <CardTitle>Verknüpfte Konten</CardTitle>
          <CardDescription>Anmeldung über externe Konten (Google).</CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleAccountLinkCard
            enabled={loginMethods.googleLoginEnabled}
            linked={Boolean(googleIdentity)}
            linkedEmail={googleIdentity?.email}
            startUrl="/api/auth/google/start?target=studio&intent=link"
            unlinkUrl="/api/auth/google/unlink"
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
          <ResponsiveTable
            caption="Letzte Anmeldungen"
            rowKey={(entry) => entry.id}
            rows={loginEvents}
            columns={[
              {
                key: "event",
                label: "Ereignis",
                primary: true,
                render: (entry) => AUDIT_ACTION_LABELS[entry.action] ?? entry.action,
              },
              {
                key: "time",
                label: "Zeit",
                render: (entry) => formatStudioDateTime(entry.timestamp),
              },
            ]}
            empty={
              <p className="text-sm text-muted-foreground">
                Noch keine Login-Ereignisse protokolliert.
              </p>
            }
          />
        </CardContent>
      </Card>
    </SystemShell>
  );
}
