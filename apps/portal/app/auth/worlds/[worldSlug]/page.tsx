import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/src/components/AuthHeader";
import { PreviewAsPlayerForm } from "@/src/components/PreviewAsPlayerForm";
import {
  canUsePreview,
  getAccessContextForWorld,
  getCurrentUser,
  getPreviewUserId,
  getWorldPlayers,
} from "@/src/lib/auth";
import { createAuthService, createPrismaClient } from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function AuthWorldPage({ params }: Props) {
  const { worldSlug } = await params;
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let pages;
  try {
    pages = await auth.listPagesForViewer(worldSlug, ctx);
  } finally {
    await db.$disconnect();
  }

  const previewEnabled = await canUsePreview(worldSlug);
  const previewUserId = await getPreviewUserId();
  const players = previewEnabled ? await getWorldPlayers(worldSlug) : [];

  return (
    <main className="auth-page">
      <AuthHeader user={user} />
      <section className="auth-card auth-card-wide">
        <div className="auth-breadcrumb">
          <Link href="/auth/worlds">Welten</Link> / {worldSlug}
        </div>

        <h1>{worldSlug}</h1>
        <p className="auth-lead">
          Sichtbarkeit: {ctx.effectiveRole}
          {ctx.previewAsUserId ? " (Preview-as-Player aktiv)" : ""}
        </p>

        <p>
          <Link href={`/auth/worlds/${worldSlug}/sessions`}>Session-Recaps anzeigen →</Link>
        </p>

        {previewEnabled && (
          <PreviewAsPlayerForm
            worldSlug={worldSlug}
            players={players.map((entry) => ({
              id: entry.user.id,
              displayName: entry.user.displayName,
              characterName: entry.characterName,
            }))}
            currentPreviewUserId={previewUserId}
          />
        )}

        <ul className="auth-page-list">
          {pages.map((page) => (
            <li key={page.id}>
              <Link href={`/auth/worlds/${worldSlug}/${page.slug}`}>
                <strong>{page.title}</strong>
                <span>{page.visibility}</span>
              </Link>
            </li>
          ))}
        </ul>

        {pages.length === 0 && (
          <p>Für deine Rolle sind derzeit keine Inhalte freigegeben.</p>
        )}
      </section>
    </main>
  );
}
