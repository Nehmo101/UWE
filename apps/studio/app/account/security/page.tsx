import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AUDIT_ACTION_LABELS,
  createAuditLogService,
  prisma,
} from "@uwe/database/server";
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
            <table className="uwe-page-table">
              <thead>
                <tr>
                  <th>Zeit</th>
                  <th>Ereignis</th>
                </tr>
              </thead>
              <tbody>
                {loginEvents.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatStudioDateTime(entry.timestamp)}</td>
                    <td>{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</td>
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
