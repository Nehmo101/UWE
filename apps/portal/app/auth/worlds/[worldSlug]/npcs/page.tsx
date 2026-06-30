import Link from "next/link";
import { notFound } from "next/navigation";
import { GlobalSearchForm, PageTypeBadge, VisibilityBadge } from "@uwe/shared-ui";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";

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
    <section className="portal-content-card">
      <h1>NPCs</h1>
      <p className="auth-lead">
        Bekannte Nicht-Spieler-Charaktere, die für deine Rolle ({ctx.effectiveRole}) freigeschaltet
        sind.
      </p>

      <GlobalSearchForm
        action={`/auth/worlds/${worldSlug}/npcs`}
        query={q ?? ""}
        placeholder="NPCs durchsuchen…"
      />

      <ul className="auth-page-list">
        {filtered.map((page) => (
          <li key={page.id}>
            <Link href={`/auth/worlds/${worldSlug}/${page.slug}`}>
              <strong>{page.title}</strong>
              <span className="auth-page-list-badges">
                <PageTypeBadge type={page.type} />
                <VisibilityBadge visibility={page.visibility} />
              </span>
              {page.summary && <p className="portal-dash-summary">{page.summary}</p>}
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p>
          {query
            ? "Keine passenden NPCs gefunden."
            : "Noch keine NPCs für deine Rolle freigeschaltet."}
        </p>
      )}
    </section>
  );
}
