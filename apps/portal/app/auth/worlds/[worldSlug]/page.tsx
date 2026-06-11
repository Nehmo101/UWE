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
import {
  EmptyState,
  GlobalSearchForm,
  PageTypeBadge,
  SearchFilterBar,
  SearchResultsList,
  VisibilityBadge,
} from "@uwe/shared-ui";
import {
  createAuthService,
  createPrismaClient,
  SEARCH_ENTITY_FILTER_LABELS,
  SEARCH_ENTITY_FILTERS,
  type SearchEntityFilter,
  type SearchResultItem,
  type DbPage,
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

  let pages: DbPage[] = [];
  let searchResults: SearchResultItem[] = [];
  try {
    if (isSearching) {
      searchResults = await auth.searchForViewer(worldSlug, ctx, {
        query: q!,
        entityFilter: entityFilter as SearchEntityFilter | undefined,
      });
    } else {
      pages = await auth.listPagesForViewer(worldSlug, ctx);
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
          <Link href="/auth/worlds">Welten</Link> / {worldSlug}
        </div>

        <h1>{worldSlug}</h1>
        <p className="auth-lead">
          Sichtbarkeit: {ctx.effectiveRole}
          {ctx.previewAsUserId ? " (Preview-as-Player aktiv)" : ""}
        </p>

        <GlobalSearchForm
          action={`/auth/worlds/${worldSlug}`}
          query={q ?? ""}
          placeholder="Erlaubte Inhalte durchsuchen…"
        />

        <div className="auth-quick-links">
          <Link href={`/auth/worlds/${worldSlug}/sessions`}>Session-Recaps</Link>
          <Link href={`/auth/worlds/${worldSlug}/assets`}>Assets</Link>
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
        ) : (
          <ul className="auth-page-list">
            {pages.map((page) => (
              <li key={page.id}>
                <Link href={`/auth/worlds/${worldSlug}/${page.slug}`}>
                  <strong>{page.title}</strong>
                  <div className="auth-page-list-badges">
                    <PageTypeBadge type={page.type} />
                    <VisibilityBadge visibility={page.visibility} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!isSearching && pages.length === 0 && (
          <EmptyState
            title="Keine Inhalte freigegeben"
            description="Für deine Rolle sind derzeit keine Seiten sichtbar. Wende dich an deinen Spielleiter."
          />
        )}
      </section>
    </main>
  );
}
