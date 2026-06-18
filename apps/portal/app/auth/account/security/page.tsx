import Link from "next/link";
import { redirect } from "next/navigation";
import { TwoFactorSetupForm } from "@uwe/shared-ui";
import { AuthHeader } from "@/src/components/AuthHeader";
import { getCurrentUser } from "@/src/lib/auth";

export default async function PortalAccountSecurityPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/auth/account/security");
  }

  return (
    <main className="auth-page">
      <AuthHeader user={user} />
      <section className="auth-card">
        <h1>Sicherheit</h1>
        <p className="auth-lead">
          Angemeldet als {user.displayName}
          {user.email ? ` (${user.email})` : ""}.
        </p>
        <TwoFactorSetupForm variant="portal" backHref="/auth/account/password" />
        <p className="auth-footer">
          <Link href="/auth/account/password">Passwort ändern</Link>
        </p>
      </section>
    </main>
  );
}
