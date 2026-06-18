import { redirect } from "next/navigation";
import { createPrismaClient, createUserService } from "@uwe/database/server";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { getCurrentAuthUser } from "@/src/lib/auth";

export default async function AccountPasswordPage() {
  const user = await getCurrentAuthUser();
  if (!user) {
    redirect("/login?redirect=/account/password");
  }

  const db = createPrismaClient();
  const users = createUserService(db);
  let forcePasswordChange = false;

  try {
    const profile = await users.getUserById(user.id);
    forcePasswordChange = profile?.forcePasswordChange ?? false;
  } finally {
    await db.$disconnect();
  }

  return (
    <main className="studio-auth-page">
      <section className="studio-auth-card">
        <h1>Passwort ändern</h1>
        <p className="studio-auth-lead">
          Angemeldet als {user.displayName}
          {user.email ? ` (${user.email})` : ""}.
        </p>
        <ChangePasswordForm backHref="/" forcePasswordChange={forcePasswordChange} />
      </section>
    </main>
  );
}
