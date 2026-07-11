import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalActiveSessionsList } from "@/src/components/PortalActiveSessionsList";
import { TwoFactorSetupForm } from "@/src/components/TwoFactorSetupForm";
import { PageHeader } from "@/src/components/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { getCurrentSession } from "@/src/lib/auth";
import {
  createPrismaClient,
} from "@uwe/database/server";
import { listActiveSessionsForUser } from "@uwe/database/account-session";

export default async function PortalAccountSecurityPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?redirect=/auth/account/security");
  }

  const user = session.user;
  const db = createPrismaClient();
  let activeSessions;
  try {
    activeSessions = await listActiveSessionsForUser(db, user.id, {
      currentSessionId: session.id,
    });
  } finally {
    await db.$disconnect();
  }

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
