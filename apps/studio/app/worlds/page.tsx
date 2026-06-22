import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import { getAppRepository } from "@uwe/database/server";
import { ADMIN_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import { CreateWorldForm } from "@/components/CreateWorldForm";
import { getCurrentAuthUser } from "@/src/lib/auth";

export default async function WorldsPage() {
  const [worlds, user] = await Promise.all([
    getAppRepository().listWorlds(),
    getCurrentAuthUser(),
  ]);
  const canCreateWorld = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;

  return (
    <AdminModuleShell
      activePath="/worlds"
      title="Welten"
      summary="Wähle eine Welt für Kampagne und Wiki-Bearbeitung — oder lege eine neue an."
    >
      {canCreateWorld ? (
        <section className="uwe-card uwe-section">
          <CreateWorldForm />
        </section>
      ) : null}

      {worlds.length === 0 ? (
        <EmptyState
          title="Noch keine Welten"
          description="Erstelle oben deine erste Welt — oder importiere später Inhalte über Welt → Import."
        />
      ) : (
        <section className="uwe-section">
          <h2 className="uwe-section-title">Deine Welten</h2>
          <div className="wiki-world-grid">
            {worlds.map((world) => (
              <article key={world.id} className="wiki-world-card">
                <h2>{world.name}</h2>
                {world.description && <p>{world.description}</p>}
                <div className="uwe-inline-actions">
                  <Link className="uwe-btn uwe-btn-primary uwe-btn-sm" href={`/worlds/${world.slug}/dashboard`}>
                    Welt verwalten
                  </Link>
                  <Link className="uwe-btn uwe-btn-secondary uwe-btn-sm" href={`/worlds/${world.slug}/soundboard`}>
                    Soundboard
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </AdminModuleShell>
  );
}
