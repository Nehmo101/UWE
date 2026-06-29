import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthPageLayout } from "@uwe/shared-ui";
import { createPrismaClient, createUserService } from "@uwe/database/server";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { BreadcrumbTrail, SystemShell } from "@/src/components/shell";
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
      <AuthPageLayout variant="studio" compact>
        <AuthCard
          variant="studio"
          title="Passwort ändern"
          lead={`Angemeldet als ${user.displayName}${user.email ? ` (${user.email})` : ""}.`}
          footer={<Link href="/account/security">Zwei-Faktor-Authentifizierung (2FA)</Link>}
        >
          <ChangePasswordForm
            backHref="/"
            forcePasswordChange={forcePasswordChange}
            initialPasswordOnly={initialPasswordOnly}
          />
        </AuthCard>
      </AuthPageLayout>
    </SystemShell>
  );
}
