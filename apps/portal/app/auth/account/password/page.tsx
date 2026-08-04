import Link from "next/link";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/src/components/ChangePasswordForm";
import { PageHeader } from "@/src/components/shell";
import { Card, CardContent } from "@/src/components/ui/card";
import { getCurrentUser } from "@/src/lib/auth";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";

export default async function PortalAccountPasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/auth/account/password");
  }

  const db = getSharedPrismaClient();
  let initialPasswordOnly = false;
  try {
    const stored = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    initialPasswordOnly = !stored?.passwordHash;
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }

  return (
    <>
      <PageHeader
        title="Passwort ändern"
        summary={`Angemeldet als ${user.displayName}${user.email ? ` (${user.email})` : ""}.`}
      />
      <Card className="max-w-md">
        <CardContent className="pt-6">
          <ChangePasswordForm
            backHref="/auth/worlds"
            forcePasswordChange={user.forcePasswordChange}
            initialPasswordOnly={initialPasswordOnly}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/auth/account/security" className="text-primary hover:underline">
              Zwei-Faktor-Authentifizierung (2FA)
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
