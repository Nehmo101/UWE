import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalSearchForm, PageTypeBadge } from "@uwe/shared-ui";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { buildPageListMoreParams } from "@/src/lib/page-list-params";
import { PageHeader } from "@/src/components/shell";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ q?: string; cursor?: string }>;
}

export default async function AuthWorldNpcsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { q, cursor } = await searchParams;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = getSharedPrismaClient();
  const auth = createAuthService(db);

  // Typ-/Text-Filter und Cursor in der DB-Query; das Freigabe-Tor
  // (filterPagesForViewer) bleibt im Helfer.
  let result;
  try {
    result = await auth.listPagesForViewerPaged(worldSlug, ctx, {
      type: "npc",
      query: q,
      cursor,
    });
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }

  const query = q?.trim() ?? "";
  const filtered = result.pages;

  return (
    <>
      <PageHeader
        title="NPCs"
        summary="Alle Nicht-Spieler-Charaktere dieser Welt."
      />

      <GlobalSearchForm
        action={`/auth/worlds/${worldSlug}/npcs`}
        query={q ?? ""}
        placeholder="NPCs durchsuchen…"
      />

      <ul className="mt-4 grid gap-2">
        {filtered.map((page) => (
          <li key={page.id}>
            <Link
              href={`/auth/worlds/${worldSlug}/${page.slug}`}
              className="block rounded-[var(--radius)] border border-border p-4 transition-colors hover:bg-muted/50"
            >
              <strong>{page.title}</strong>
              <div className="mt-1 flex flex-wrap gap-2">
                <PageTypeBadge type={page.type} />
              </div>
              {page.summary ? (
                <p className="mt-2 text-sm text-muted-foreground">{page.summary}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && !result.nextCursor ? (
        <PortalEmptyState
          title={query ? "Keine passenden NPCs gefunden" : "Keine NPCs freigeschaltet"}
          description={query ? "Probiere einen anderen Suchbegriff." : undefined}
          icon="users"
        />
      ) : null}

      {result.nextCursor ? (
        <p className="mt-6">
          <Link
            href={`/auth/worlds/${worldSlug}/npcs?${buildPageListMoreParams(result.nextCursor, { q: query })}`}
            className="text-primary hover:underline"
          >
            Mehr laden …
          </Link>
        </p>
      ) : null}
    </>
  );
}
