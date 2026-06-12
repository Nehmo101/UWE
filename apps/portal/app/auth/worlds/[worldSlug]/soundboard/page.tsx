import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/src/components/AuthHeader";
import { SoundboardWorkspace, type SoundboardButtonView } from "@uwe/shared-ui";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PortalSoundboardPage({ params }: Props) {
  const { worldSlug } = await params;
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let buttons;
  let worldName = worldSlug;
  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { name: true },
    });
    worldName = world?.name ?? worldSlug;
    buttons = await auth.listSoundboardForViewer(worldSlug, ctx);
  } finally {
    await db.$disconnect();
  }

  const buttonViews: SoundboardButtonView[] = buttons.map((button) => ({
    id: button.id,
    title: button.title,
    sourceType: button.sourceType,
    sourceUrl: button.sourceUrl,
    assetId: button.assetId,
    assetFileUrl: button.assetId
      ? `/api/assets/${button.assetId}/file?world=${encodeURIComponent(worldSlug)}`
      : null,
    thumbnail: button.thumbnail,
    volume: button.volume,
    loop: button.loop,
    tags: button.tags,
    visibility: button.visibility,
    linkedPages: button.linkedPages.map((page) => ({
      title: page.title,
      href: `/auth/worlds/${worldSlug}/${page.slug}`,
    })),
  }));

  return (
    <main className="auth-page">
      <AuthHeader user={user} />
      <section className="auth-card auth-card-wide">
        <div className="auth-breadcrumb">
          <Link href="/auth/worlds">Welten</Link> /{" "}
          <Link href={`/auth/worlds/${worldSlug}`}>{worldName}</Link> / Soundboard
        </div>

        <h1>Soundboard</h1>
        <p className="auth-lead">
          Ambient, Musik und Effekte für deine Rolle ({ctx.effectiveRole}) — nur freigegebene
          Sounds.
        </p>

        <SoundboardWorkspace
          buttons={buttonViews}
          spotifyPlaybackHint="Spotify-Wiedergabe ist nur im Studio verfügbar (OAuth noch nicht im Portal)."
        />

        {buttonViews.length === 0 && (
          <p>Für deine Rolle sind derzeit keine Soundboard-Buttons freigegeben.</p>
        )}
      </section>
    </main>
  );
}
