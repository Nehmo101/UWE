import Link from "next/link";
import { CreateWorldForm } from "@/src/components/CreateWorldForm";
import { getCurrentUser, listAuthWorlds } from "@/src/lib/auth";
import { ADMIN_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import { EmptyState } from "@uwe/shared-ui";

export default async function AuthWorldsPage() {
  const user = await getCurrentUser();
  const worlds = await listAuthWorlds();
  const canCreateWorld = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;

  if (worlds.length === 0) {
    return (
      <section className="portal-content-card">
        {canCreateWorld ? (
          <CreateWorldForm />
        ) : (
          <EmptyState
            title="Keine Welten gefunden"
            description={
              user
                ? "Du hast noch keinen Zugriff auf Welten. Bitte einen Owner/Admin um Freigabe."
                : "Melde dich an, um freigegebene Welten zu sehen."
            }
            action={
              user ? undefined : (
                <Link className="uwe-v2-btn uwe-v2-btn-primary" href="/login">
                  Zur Anmeldung
                </Link>
              )
            }
          />
        )}
      </section>
    );
  }

  return (
    <section className="portal-content-card">
      {canCreateWorld ? <CreateWorldForm /> : null}

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
  );
}
