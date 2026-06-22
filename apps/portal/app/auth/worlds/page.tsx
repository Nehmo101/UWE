import Link from "next/link";
import { AuthHeader } from "@/src/components/AuthHeader";
import { CreateWorldForm } from "@/src/components/CreateWorldForm";
import { getCurrentUser, listAuthWorlds } from "@/src/lib/auth";
import { ADMIN_ACCESS_ROLES, hasAnyRole, resolveUweAppUrls } from "@uwe/auth";
import { EmptyState } from "@uwe/shared-ui";

export default async function AuthWorldsPage() {
  const user = await getCurrentUser();
  const worlds = await listAuthWorlds();
  const canCreateWorld = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;
  const appUrls = resolveUweAppUrls();
  const studioSettingsUrl = appUrls.studioUrl
    ? `${appUrls.studioUrl}/settings`
    : "/settings";

  if (worlds.length === 0) {
    return (
      <main className="auth-page">
        <AuthHeader user={user} canAccessAdmin={canCreateWorld} studioSettingsUrl={studioSettingsUrl} />
        <section className="auth-card auth-card-wide">
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
                  <Link className="uwe-btn uwe-btn-primary" href="/login">
                    Zur Anmeldung
                  </Link>
                )
              }
            />
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <AuthHeader user={user} canAccessAdmin={canCreateWorld} studioSettingsUrl={studioSettingsUrl} />
      <section className="auth-card auth-card-wide">
        <h1>Freigegebene Welten</h1>
        <p className="auth-lead">
          {user
            ? `Angemeldet als ${user.displayName}`
            : "Gastmodus — nur öffentliche Inhalte sichtbar, wenn aktiviert."}
        </p>

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
    </main>
  );
}
