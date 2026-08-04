import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTypeBadge } from "@uwe/shared-ui";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { buildPageListMoreParams } from "@/src/lib/page-list-params";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";
import { PageHeader } from "@/src/components/shell";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ cursor?: string }>;
}

export default async function PortalHandoutsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { cursor } = await searchParams;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = getSharedPrismaClient();
  const auth = createAuthService(db);

  // Typ-Filter und Cursor in der DB-Query; das Freigabe-Tor bleibt im Helfer.
  let handouts;
  let nextCursor: string | null = null;
  try {
    const result = await auth.listPagesForViewerPaged(worldSlug, ctx, {
      type: "handout",
      cursor,
    });
    handouts = result.pages;
    nextCursor = result.nextCursor;
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }

  return (
    <>
      <PageHeader
        title="Handouts"
        summary="In-Game-Briefe, Karten und Dokumente dieser Welt."
      />

      <ul className="grid gap-2">
        {handouts.map((page) => (
          <li key={page.id}>
            <Link
              href={`/auth/worlds/${worldSlug}/${page.slug}`}
              className="block rounded-[var(--radius)] border border-border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex flex-wrap items-center gap-2 font-semibold">{page.title}</div>
              <div className="mt-1 flex flex-wrap gap-2">
                <PageTypeBadge type={page.type} />
              </div>
              {page.summary ? (
                <p className="mt-1 text-sm text-muted-foreground">{page.summary}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      {handouts.length === 0 && !nextCursor ? (
        <PortalEmptyState title="Keine Handouts in dieser Welt" icon="mail" />
      ) : null}

      {nextCursor ? (
        <p className="mt-4">
          <Link
            href={`/auth/worlds/${worldSlug}/handouts?${buildPageListMoreParams(nextCursor)}`}
            className="text-primary hover:underline"
          >
            Mehr laden …
          </Link>
        </p>
      ) : null}

      <p className="mt-4 text-sm text-muted-foreground">
        Bilder und Karten findest du zusätzlich in der{" "}
        <Link href={`/auth/worlds/${worldSlug}/assets`} className="text-primary hover:underline">
          Galerie
        </Link>
        .
      </p>
    </>
  );
}
