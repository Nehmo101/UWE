import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppRepository, prisma } from "@uwe/database/server";
import { createPageAiReviewService } from "@uwe/page-ai-review";
import { WorldShell, BreadcrumbTrail } from "@/src/components/shell";
import { PageAiReviewEditor } from "@/src/components/wiki/PageAiReviewEditor";
import { worldRootBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { requireStudioWorldEdit } from "@/src/lib/authz";

interface Props {
  params: Promise<{ worldSlug: string; pageId: string }>;
}

export default async function PageReviewDetailPage({ params }: Props) {
  const { worldSlug, pageId } = await params;
  await requireStudioWorldEdit(worldSlug);

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const pageAiReview = createPageAiReviewService(prisma);
  const [detail, openReviewCount] = await Promise.all([
    pageAiReview.getReviewDetail(worldSlug, pageId),
    pageAiReview.countOpenReviews(worldSlug),
  ]);
  if (!detail) notFound();

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      openReviewCount={openReviewCount}
      breadcrumb={
        <BreadcrumbTrail
          items={[
            ...worldRootBreadcrumb(world.name, worldSlug),
            { label: "Texte zur Review", href: `/worlds/${worldSlug}/page-review` },
            { label: detail.pageTitle },
          ]}
        />
      }
    >
      <div className="mb-4">
        <Link href={`/worlds/${worldSlug}/page-review`} className="text-sm text-primary hover:underline">
          ← Zurück zur Review-Liste
        </Link>
      </div>
      <PageAiReviewEditor worldSlug={worldSlug} pageId={pageId} initialDetail={detail} />
    </WorldShell>
  );
}
