import Link from "next/link";
import { redirect } from "next/navigation";
import { TwoFactorSetupForm } from "@uwe/shared-ui";
import { getCurrentUser } from "@/src/lib/auth";

export default async function PortalAccountSecurityPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/auth/account/security");
  }

  return (
    <section className="portal-content-card portal-content-card-narrow">
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
  );
}
