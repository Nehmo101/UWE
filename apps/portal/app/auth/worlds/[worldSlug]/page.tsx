import { notFound } from "next/navigation";
import { PortalWorldDashboardClient } from "@/src/components/PortalWorldDashboardClient";
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
  AppAccentScope,
  EmptyState,
  GlobalSearchForm,
  SceneHero,
  SearchFilterBar,
  SearchResultsList,
  dayIndex,
} from "@uwe/shared-ui";
import {
  createAuthService,
  getDefaultDashboardLayout,
  portalWorldPageKey,
  SEARCH_ENTITY_FILTER_LABELS,
  SEARCH_ENTITY_FILTERS,
  type SearchEntityFilter,
  type SearchResultItem,
} from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";


interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ q?: string; filter?: string }>;
}

export default async function AuthWorldPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { q, filter: entityFilter } = await searchParams;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = getSharedPrismaClient();
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
    await disconnectPrismaClientIfOwned(db);
  }

  const previewEnabled = await canUsePreview(worldSlug);
  const previewUserId = await getPreviewUserId();
  const players = previewEnabled ? await getWorldPlayers(worldSlug) : [];
  const dashboardWidgets = getDefaultDashboardLayout(portalWorldPageKey(worldSlug));

  const viewer = await getCurrentUser();
  const viewerName = ctx.previewAsUserId ? "" : (viewer?.displayName ?? "");

  return (
    <AppAccentScope app="portal">
      {/* Szene als Bühne, der bestehende Welt-Inhalt fließt darunter weiter. */}
      <SceneHero
        area="portal"
        sceneIndex={dayIndex()}
        size="portal"
        veil="portal"
        groundStart="34%"
        groundEnd="84%"
        eyebrow={viewerName ? `Willkommen zurück, ${viewerName}` : "Willkommen zurück"}
        title={worldName}
        lede={
          ctx.previewAsUserId
            ? "Preview-as-Player aktiv — du siehst die Welt mit den Rechten des gewählten Spielers."
            : "Dein Fenster in die Kampagne — alles hier ist für dich freigegeben."
        }
      />

      <GlobalSearchForm
        action={`/auth/worlds/${worldSlug}`}
        query={q ?? ""}
        placeholder="Erlaubte Inhalte durchsuchen…"
      />

      {previewEnabled ? (
        <div className="my-4">
          <PreviewAsPlayerForm
            worldSlug={worldSlug}
            players={players.map((entry) => ({
              id: entry.user.id,
              displayName: entry.user.displayName,
              characterName: entry.characterName,
            }))}
            currentPreviewUserId={previewUserId}
          />
        </div>
      ) : null}

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
        <PortalWorldDashboardClient
          worldSlug={worldSlug}
          dashboard={dashboard}
          widgets={dashboardWidgets}
        />
      ) : (
        <EmptyState
          title="Keine Inhalte freigegeben"
          description="Für deine Rolle sind derzeit keine Inhalte sichtbar. Wende dich an deinen Spielleiter."
        />
      )}
    </AppAccentScope>
  );
}
