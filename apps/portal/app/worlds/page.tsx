import Link from "next/link";
import { getCurrentUser, listPortalWorlds } from "@/src/lib/auth";
import { PortalPublicShell } from "@/src/components/PortalPublicShell";
import { portalDiscoverBottomNav } from "@/src/lib/mobile-nav";
import { EmptyState } from "@uwe/shared-ui";

export default async function PortalWorldsPage() {
  const [worlds, user] = await Promise.all([listPortalWorlds(), getCurrentUser()]);

  return (
    <PortalPublicShell
      publicActive="discover"
      bottomNav={portalDiscoverBottomNav("discover")}
      brandHref="/worlds"
      topBarExtra={
        user ? (
          <Link href="/auth/worlds" className="portal-login-link">
            Meine Welten
          </Link>
        ) : (
          <Link href="/login" className="portal-login-link">
            Anmelden
          </Link>
        )
      }
    >
      <header className="uwe-page-header">
        <div className="uwe-page-header-main">
          <h1>Welten entdecken</h1>
          <p className="uwe-page-summary">
            Wähle eine Welt und erkunde freigegebene Inhalte.
          </p>
        </div>
      </header>

      {worlds.length === 0 ? (
        <EmptyState
          title="Noch keine Welten verfügbar"
          description="Dir wurden noch keine Welten zugeordnet. Bitte wende dich an deinen Spielleiter."
          action={
            <Link className="uwe-btn uwe-btn-primary" href="/login">
              Anmelden
            </Link>
          }
        />
      ) : (
        <div className="wiki-world-grid">
          {worlds.map((world) => (
            <article key={world.id} className="wiki-world-card">
              <h2>{world.name}</h2>
              {world.description && <p>{world.description}</p>}
              <Link href={`/worlds/${world.slug}`}>Welt betreten →</Link>
            </article>
          ))}
        </div>
      )}
    </PortalPublicShell>
  );
}
