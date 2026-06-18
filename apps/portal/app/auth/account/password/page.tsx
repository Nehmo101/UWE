import Link from "next/link";
import { redirect } from "next/navigation";
import { createPrismaClient } from "@uwe/database/server";
import { AuthHeader } from "@/src/components/AuthHeader";
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
    <main className="auth-page">
      <AuthHeader user={user} />
      <section className="auth-card">
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
    </main>
  );
}
