import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/src/components/AuthHeader";
import { PlayerDashboard } from "@/src/components/PlayerDashboard";
import { PreviewAsPlayerForm } from "@/src/components/PreviewAsPlayerForm";
import {
  canUsePreview,
  getAccessContextForWorld,
  getCurrentUser,
  getPreviewUserId,
  getWorldPlayers,
} from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import {
  EmptyState,
  GlobalSearchForm,
  SearchFilterBar,
  SearchResultsList,
} from "@uwe/shared-ui";
import {
  createAuthService,
  createPrismaClient,
  SEARCH_ENTITY_FILTER_LABELS,
  SEARCH_ENTITY_FILTERS,
  type SearchEntityFilter,
  type SearchResultItem,
} from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ q?: string; filter?: string }>;
}

export default async function AuthWorldPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { q, filter: entityFilter } = await searchParams;
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  const isSearching = Boolean(q?.trim());

  let dashboard = null;
  let searchResults: SearchResultItem[] = [];
  let worldName = worldSlug;

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, name: true },
    });
    if (!world) {
      notFound();
    }

    try {
      assertPortalCanReadWorld(ctx, world.id);
    } catch {
      notFound();
    }

    worldName = world.name;

    if (isSearching) {
      searchResults = await auth.searchForViewer(worldSlug, ctx, {
        query: q!,
        entityFilter: entityFilter as SearchEntityFilter | undefined,
      });
    } else {
      dashboard = await auth.getPortalDashboard(worldSlug, ctx);
    }
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
          <Link href="/auth/worlds">Welten</Link> / {worldName}
        </div>

        <h1>{worldName}</h1>
        <p className="auth-lead">
          Kampagnen-Dashboard
          {ctx.previewAsUserId ? " (Preview-as-Player aktiv)" : ""}
        </p>

        <GlobalSearchForm
          action={`/auth/worlds/${worldSlug}`}
          query={q ?? ""}
          placeholder="Erlaubte Inhalte durchsuchen…"
        />

        <div className="auth-quick-links">
          <Link href={`/auth/worlds/${worldSlug}/sessions`}>Session-Recaps</Link>
          <Link href={`/auth/worlds/${worldSlug}/notes`}>Meine Notizen</Link>
          <Link href={`/auth/worlds/${worldSlug}/assets`}>Handouts</Link>
          <Link href={`/auth/worlds/${worldSlug}/soundboard`}>Soundboard</Link>
        </div>

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

        {isSearching ? (
          <>
            <SearchFilterBar
              action={`/auth/worlds/${worldSlug}`}
              query={q}
              filters={[
                {
                  name: "filter",
                  label: "Typ",
                  value: entityFilter,
                  options: SEARCH_ENTITY_FILTERS.map((filter) => ({
                    value: filter,
                    label: SEARCH_ENTITY_FILTER_LABELS[filter],
                  })),
                },
              ]}
            />
            <SearchResultsList results={searchResults} query={q} />
          </>
        ) : dashboard ? (
          <PlayerDashboard worldSlug={worldSlug} dashboard={dashboard} />
        ) : (
          <EmptyState
            title="Keine Inhalte freigegeben"
            description="Für deine Rolle sind derzeit keine Inhalte sichtbar. Wende dich an deinen Spielleiter."
          />
        )}
      </section>
    </main>
  );
}
