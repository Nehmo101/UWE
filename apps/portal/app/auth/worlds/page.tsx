import Link from "next/link";
import { AuthHeader } from "@/src/components/AuthHeader";
import { getCurrentUser, listAuthWorlds } from "@/src/lib/auth";
import { EmptyState } from "@uwe/shared-ui";

export default async function AuthWorldsPage() {
  const user = await getCurrentUser();
  const worlds = await listAuthWorlds();

  if (worlds.length === 0) {
    return (
      <main className="auth-page">
        <AuthHeader user={user} />
        <section className="auth-card auth-card-wide">
          <EmptyState
            title="Keine Welten gefunden"
            description="Führe zuerst pnpm --filter @uwe/database db:seed aus, um Demo-Inhalte zu laden."
            action={
              <Link className="uwe-btn uwe-btn-primary" href="/login">
                Zur Anmeldung
              </Link>
            }
          />
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <AuthHeader user={user} />
      <section className="auth-card auth-card-wide">
        <h1>Freigegebene Welten</h1>
        <p className="auth-lead">
          {user
            ? `Angemeldet als ${user.displayName}`
            : "Gastmodus — nur öffentliche Inhalte sichtbar, wenn aktiviert."}
        </p>

        <ul className="auth-world-list">
          {worlds.map((world) => (
            <li key={world.id}>
              <Link href={`/auth/worlds/${world.slug}`}>
                <strong>{world.name}</strong>
                {world.description && <span>{world.description}</span>}
                <em>{world.guestModeEnabled ? "Gastmodus aktiv" : "Login erforderlich"}</em>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
