import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalSearchForm, PageTypeBadge } from "@uwe/shared-ui";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PageHeader } from "@/src/components/shell";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function AuthWorldNpcsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { q } = await searchParams;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let npcs;
  try {
    const pages = await auth.listPagesForViewer(worldSlug, ctx);
    npcs = pages.filter((page) => page.type === "npc");
  } finally {
    await db.$disconnect();
  }

  const query = q?.trim().toLocaleLowerCase("de") ?? "";
  const filtered = query
    ? npcs.filter((page) => {
        const haystack = [page.title, page.slug, page.summary ?? ""]
          .join(" ")
          .toLocaleLowerCase("de");
        return haystack.includes(query);
      })
    : npcs;

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

      {filtered.length === 0 ? (
        <PortalEmptyState
          title={query ? "Keine passenden NPCs gefunden" : "Keine NPCs freigeschaltet"}
          description={query ? "Probiere einen anderen Suchbegriff." : undefined}
          icon="users"
        />
      ) : null}
    </>
  );
}
