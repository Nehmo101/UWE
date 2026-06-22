import { notFound } from "next/navigation";
import { SoundboardWorkspace, type SoundboardButtonView } from "@uwe/shared-ui";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PortalSoundboardPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let buttons;
  try {
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
    <section className="portal-content-card">
      <h1>Soundboard</h1>
      <p className="auth-lead">
        Ambient, Musik und Effekte für deine Rolle ({ctx.effectiveRole}) — nur freigegebene Sounds.
      </p>

      <SoundboardWorkspace
        buttons={buttonViews}
        spotifyPlaybackHint="Spotify-Wiedergabe wird nur im Studio gesteuert (Spotify Connect / Web API). Im Portal sind Spotify-Buttons nur zur Anzeige."
      />

      {buttonViews.length === 0 && (
        <p>Für deine Rolle sind derzeit keine Soundboard-Buttons freigegeben.</p>
      )}
    </section>
  );
}
