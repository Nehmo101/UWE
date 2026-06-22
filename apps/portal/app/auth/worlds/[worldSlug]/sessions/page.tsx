import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { createAuthService, createPrismaClient } from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PortalSessionsPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let sessions;
  try {
    sessions = await auth.listGameSessionsForViewer(worldSlug, ctx);
  } finally {
    await db.$disconnect();
  }

  return (
    <section className="portal-content-card">
      <h1>Session-Recaps</h1>
      <p className="auth-lead">Veröffentlichte Zusammenfassungen vergangener Spielabende.</p>

      <ul className="auth-page-list">
        {sessions.map((session) => (
          <li key={session.id}>
            <Link href={`/auth/worlds/${worldSlug}/sessions/${session.id}`}>
              <strong>
                Session {session.sessionNumber}: {session.title}
              </strong>
              {session.date && <span>{session.date.toLocaleDateString("de-DE")}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {sessions.length === 0 && <p>Derzeit sind keine Session-Recaps veröffentlicht.</p>}
    </section>
  );
}
