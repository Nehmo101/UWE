import { notFound } from "next/navigation";
import { SoundboardWorkspace, type SoundboardButtonView } from "@uwe/shared-ui";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

function sourceTypeSummary(buttons: SoundboardButtonView[]): string {
  const counts = buttons.reduce(
    (acc, button) => {
      acc[button.sourceType] = (acc[button.sourceType] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const parts: string[] = [];
  if (counts.local) parts.push(`${counts.local} lokal`);
  if (counts.youtube) parts.push(`${counts.youtube} YouTube`);
  if (counts.spotify) parts.push(`${counts.spotify} Spotify`);
  return parts.join(" · ") || "Keine Sounds";
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

  const hasLocalButtons = buttonViews.some((button) => button.sourceType === "local");
  const hasSpotifyButtons = buttonViews.some((button) => button.sourceType === "spotify");

  return (
    <section className="portal-content-card portal-soundboard-page">
      <h1>Soundboard</h1>
      <p className="auth-lead">
        Ambient, Musik und Effekte für deine Rolle ({ctx.effectiveRole}) — nur freigegebene Sounds.
      </p>

      <div className="portal-soundboard-hints">
        <p className="portal-soundboard-hint">
          <strong>Wiedergabe auf deinem Gerät:</strong> Sounds starten lokal in deinem Browser. Jede
          Spielerin und jeder Spieler hört auf dem eigenen Gerät — die Lautstärke ist pro Person
          einstellbar.
        </p>
        <p className="portal-soundboard-hint portal-soundboard-hint-vision">
          <strong>Zukunft — gemeinsame Audio-Synchronisation:</strong> Eine zeitgleiche Wiedergabe für
          alle am Tisch (DM startet, alle hören synchron) ist als Vision geplant, erfordert aber noch
          Live-Sync zwischen Studio und Portal. Bis dahin steuert der DM Sounds im Studio; im Portal
          kannst du freigegebene Buttons selbst abspielen.
        </p>
        {hasLocalButtons && (
          <p className="portal-soundboard-hint">
            Lokale Dateien werden direkt aus UWE geladen. Für unterbrechungsfreie Atmosphäre am
            Spieltisch empfiehlt sich ein kurzer Test vor der Session.
          </p>
        )}
        {hasSpotifyButtons && (
          <p className="portal-soundboard-hint">
            Spotify-Buttons sind im Portal nur zur Übersicht — Wiedergabe und Geräteauswahl erfolgen im
            Studio (Spotify Connect / Web API).
          </p>
        )}
      </div>

      {buttonViews.length > 0 && (
        <p className="auth-muted portal-soundboard-summary">
          {buttonViews.length} {buttonViews.length === 1 ? "Sound" : "Sounds"} für dich freigegeben
          ({sourceTypeSummary(buttonViews)}).
        </p>
      )}

      {buttonViews.length === 0 ? (
        <PortalEmptyState title="Keine Soundboard-Buttons freigegeben" icon="volume-2" />
      ) : (
        <SoundboardWorkspace
          buttons={buttonViews}
          spotifyPlaybackHint="Spotify-Wiedergabe wird nur im Studio gesteuert (Spotify Connect / Web API). Im Portal sind Spotify-Buttons nur zur Anzeige."
        />
      )}
    </section>
  );
}
