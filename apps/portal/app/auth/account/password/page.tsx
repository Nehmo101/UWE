import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeader } from "@/src/components/AuthHeader";
import { ChangePasswordForm } from "@/src/components/ChangePasswordForm";
import { getCurrentUser } from "@/src/lib/auth";

export default async function PortalAccountPasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/auth/account/password");
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
        />
        <p className="auth-footer">
          <Link href="/auth/account/security">Zwei-Faktor-Authentifizierung (2FA)</Link>
        </p>
      </section>
    </main>
  );
}
