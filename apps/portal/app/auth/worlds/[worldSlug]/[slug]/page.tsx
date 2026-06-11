import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/src/components/AuthHeader";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
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

        <header>
          <h1>{page.title}</h1>
          {page.summary && <p className="auth-lead">{page.summary}</p>}
        </header>

        <div className="auth-blocks">
          {page.contentBlocks.map((block) => (
            <section key={block.id} className="auth-block">
              <p className="auth-block-meta">{block.type} · {block.visibility}</p>
              <div>{block.content}</div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
