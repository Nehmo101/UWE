import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/src/components/AuthHeader";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { createAuthService, createPrismaClient } from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string; sessionId: string }>;
}

export default async function PortalSessionDetailPage({ params }: Props) {
  const { worldSlug, sessionId } = await params;
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let session;
  try {
    session = await auth.getGameSessionForViewer(worldSlug, sessionId, ctx);
  } finally {
    await db.$disconnect();
  }

  if (!session) {
    notFound();
  }

  return (
    <main className="auth-page">
      <AuthHeader user={user} />
      <article className="auth-card auth-card-wide">
        <div className="auth-breadcrumb">
          <Link href="/auth/worlds">Welten</Link> /{" "}
          <Link href={`/auth/worlds/${worldSlug}`}>{worldSlug}</Link> /{" "}
          <Link href={`/auth/worlds/${worldSlug}/sessions`}>Sessions</Link> /{" "}
          {session.title}
        </div>

        <header>
          <h1>Session {session.sessionNumber}: {session.title}</h1>
          {session.date && (
            <p className="auth-lead">{session.date.toLocaleDateString("de-DE")}</p>
          )}
        </header>

        {session.summaryPlayer ? (
          <section className="auth-block">
            <h2>Recap</h2>
            <div>{session.summaryPlayer}</div>
          </section>
        ) : (
          <p>Kein Recap-Text vorhanden.</p>
        )}

        {session.linkedPages.length > 0 && (
          <section className="auth-block">
            <h2>Verknüpfte Inhalte</h2>
            <ul className="auth-page-list">
              {session.linkedPages.map((page) => (
                <li key={page.id}>
                  <Link href={`/auth/worlds/${worldSlug}/${page.slug}`}>
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </main>
  );
}
