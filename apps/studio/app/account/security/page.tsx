import Link from "next/link";
import { redirect } from "next/navigation";
import { TwoFactorSetupForm } from "@uwe/shared-ui";
import { getCurrentAuthUser } from "@/src/lib/auth";

export default async function AccountSecurityPage() {
  const user = await getCurrentAuthUser();
  if (!user) {
    redirect("/login?redirect=/account/security");
  }

  return (
    <main className="studio-auth-page">
      <section className="studio-auth-card">
        <h1>Sicherheit</h1>
        <p className="studio-auth-lead">
          Angemeldet als {user.displayName}
          {user.email ? ` (${user.email})` : ""}.
        </p>
        <TwoFactorSetupForm variant="studio" backHref="/account/password" />
        <p className="studio-auth-footer">
          <Link href="/account/password">Passwort ändern</Link>
        </p>
      </section>
    </main>
  );
}
