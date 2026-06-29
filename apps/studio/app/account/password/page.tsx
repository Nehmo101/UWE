import Link from "next/link";
import { redirect } from "next/navigation";
import { createPrismaClient, createUserService } from "@uwe/database/server";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import {
  BreadcrumbTrail,
  SystemShell,
} from "@/src/components/shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { getCurrentAuthUser } from "@/src/lib/auth";

export default async function AccountPasswordPage() {
  const user = await getCurrentAuthUser();
  if (!user) {
    redirect("/login?redirect=/account/password");
  }

  const db = createPrismaClient();
  const users = createUserService(db);
  let forcePasswordChange = false;
  let initialPasswordOnly = false;

  try {
    const profile = await users.getUserById(user.id);
    forcePasswordChange = profile?.forcePasswordChange ?? false;
    const stored = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    initialPasswordOnly = !stored?.passwordHash;
  } finally {
    await db.$disconnect();
  }

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Einstellungen", href: "/settings" },
            { label: "Passwort" },
          ]}
        />
      }
    >
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Passwort ändern</CardTitle>
          <CardDescription>
            Angemeldet als {user.displayName}
            {user.email ? ` (${user.email})` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm
            backHref="/"
            forcePasswordChange={forcePasswordChange}
            initialPasswordOnly={initialPasswordOnly}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/account/security" className="text-primary hover:underline">
              Zwei-Faktor-Authentifizierung (2FA)
            </Link>
          </p>
        </CardContent>
      </Card>
    </SystemShell>
  );
}
