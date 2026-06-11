import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/src/components/AuthHeader";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import {
  BLOCK_TYPE_LABELS,
  PageTypeBadge,
  VisibilityBadge,
} from "@uwe/shared-ui";
import { createAuthService, createPrismaClient } from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string; slug: string }>;
}

export default async function AuthWorldPageDetail({ params }: Props) {
  const { worldSlug, slug } = await params;
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let page;
  try {
    page = await auth.getPageForViewer(worldSlug, slug, ctx);
  } finally {
    await db.$disconnect();
  }

  if (!page) {
    notFound();
  }

  return (
    <main className="auth-page">
      <AuthHeader user={user} />
      <article className="auth-card auth-card-wide">
        <div className="auth-breadcrumb">
          <Link href="/auth/worlds">Welten</Link> /{" "}
          <Link href={`/auth/worlds/${worldSlug}`}>{worldSlug}</Link> / {page.title}
        </div>

        <header className="auth-page-header">
          <h1>{page.title}</h1>
          <div className="auth-page-list-badges">
            <PageTypeBadge type={page.type} />
            <VisibilityBadge visibility={page.visibility} />
          </div>
          {page.summary && <p className="auth-lead">{page.summary}</p>}
        </header>

        <div className="auth-blocks">
          {page.contentBlocks.map((block) => (
            <section key={block.id} className="auth-block">
              <div className="auth-block-meta">
                <span className="uwe-badge uwe-badge-type">{BLOCK_TYPE_LABELS[block.type]}</span>
                <VisibilityBadge visibility={block.visibility} />
              </div>
              <div className="auth-block-content wiki-content">{block.content}</div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
