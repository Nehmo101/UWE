import Link from "next/link";
import { redirect } from "next/navigation";
import { createPrismaClient } from "@uwe/database/server";
import { ChangePasswordForm } from "@/src/components/ChangePasswordForm";
import { getCurrentUser } from "@/src/lib/auth";

export default async function PortalAccountPasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/auth/account/password");
  }

  const db = createPrismaClient();
  let initialPasswordOnly = false;
  try {
    const stored = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    initialPasswordOnly = !stored?.passwordHash;
  } finally {
    await db.$disconnect();
  }

  return (
    <section className="portal-content-card portal-content-card-narrow">
      <h1>Passwort ändern</h1>
      <p className="auth-lead">
        Angemeldet als {user.displayName}
        {user.email ? ` (${user.email})` : ""}.
      </p>
      <ChangePasswordForm
        backHref="/auth/worlds"
        forcePasswordChange={user.forcePasswordChange}
        initialPasswordOnly={initialPasswordOnly}
      />
      <p className="auth-footer">
        <Link href="/auth/account/security">Zwei-Faktor-Authentifizierung (2FA)</Link>
      </p>
    </section>
  );
}
