import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleAccountLinkCard } from "@/src/components/GoogleAccountLinkCard";
import { PasskeySettingsPanel } from "@/src/components/PasskeySettingsPanel";
import { PortalActiveSessionsList } from "@/src/components/PortalActiveSessionsList";
import { TwoFactorSetupForm } from "@/src/components/TwoFactorSetupForm";
import { PageHeader } from "@/src/components/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { getCurrentSession } from "@/src/lib/auth";
import {
  createPrismaClient,
} from "@uwe/database/server";
import { listActiveSessionsForUser } from "@uwe/database/account-session";
import { getSystemSettingsSnapshotSafe } from "@uwe/database/settings-service";
import { createAuthIdentityService } from "@uwe/database/auth-identities";
import { resolveLoginMethodsPublicConfig } from "@uwe/database/login-methods-settings";
import { resolveStudioPublicBaseUrl } from "@uwe/auth";

export default async function PortalAccountSecurityPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?redirect=/auth/account/security");
  }

  const user = session.user;
  const db = createPrismaClient();
  let activeSessions;
  let googleIdentity = null;
  try {
    activeSessions = await listActiveSessionsForUser(db, user.id, {
      currentSessionId: session.id,
    });
    const identities = await createAuthIdentityService(db).listForUser(user.id);
    googleIdentity = identities.find((identity) => identity.provider === "google") ?? null;
  } finally {
    await db.$disconnect();
  }
  const { settings } = await getSystemSettingsSnapshotSafe();
  const loginMethods = resolveLoginMethodsPublicConfig(settings.auth);

  return (
    <>
      <PageHeader
        title="Sicherheit"
        summary={`Angemeldet als ${user.displayName}${user.email ? ` (${user.email})` : ""}.`}
      />

      <div className="mt-4 grid gap-5">
        <Card className="max-w-2xl">
          <CardContent className="pt-6">
            <TwoFactorSetupForm backHref="/auth/account/password" />
            <p className="mt-4 text-sm text-muted-foreground">
              <Link href="/auth/account/password" className="text-primary hover:underline">
                Passwort ändern
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Passkeys</CardTitle>
            <p className="text-sm text-muted-foreground">
              Anmeldung per Face ID, Touch ID, Fingerabdruck oder Sicherheitsschlüssel.
            </p>
          </CardHeader>
          <CardContent>
            <PasskeySettingsPanel
              enabled={settings.auth.passkeysEnabled}
              disabledHint="Passkey-Login ist derzeit deaktiviert. Wende dich an deine Spielleitung."
            />
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Verknüpfte Konten</CardTitle>
            <p className="text-sm text-muted-foreground">
              Anmeldung über externe Konten (Google).
            </p>
          </CardHeader>
          <CardContent>
            <GoogleAccountLinkCard
              enabled={loginMethods.googleLoginEnabled}
              linked={Boolean(googleIdentity)}
              linkedEmail={googleIdentity?.email}
              startUrl={`${resolveStudioPublicBaseUrl()}/api/auth/google/start?target=portal&intent=link`}
              unlinkUrl="/api/auth/google/unlink"
            />
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Aktive Sitzungen</CardTitle>
            <p className="text-sm text-muted-foreground">
              Geräte und Browser, mit denen du aktuell angemeldet bist. Beim Passwort ändern werden
              alle anderen Sitzungen beendet.
            </p>
          </CardHeader>
          <CardContent>
            <PortalActiveSessionsList sessions={activeSessions} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
