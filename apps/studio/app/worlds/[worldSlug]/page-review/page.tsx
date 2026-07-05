import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@uwe/shared-ui";
import { getAppRepository, prisma } from "@uwe/database/server";
import { createPageAiReviewService } from "@uwe/page-ai-review";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldRootBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { requireStudioWorldEdit } from "@/src/lib/authz";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PageReviewListPage({ params }: Props) {
  const { worldSlug } = await params;
  await requireStudioWorldEdit(worldSlug);

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const pageAiReview = createPageAiReviewService(prisma);
  const [entries, openReviewCount] = await Promise.all([
    pageAiReview.listReviewPages(worldSlug),
    pageAiReview.countOpenReviews(worldSlug),
  ]);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      openReviewCount={openReviewCount}
      breadcrumb={
        <BreadcrumbTrail
          items={[
            ...worldRootBreadcrumb(world.name, worldSlug),
            { label: "Texte zur Review" },
          ]}
        />
      }
    >
      <PageHeader
        title="Texte zur Review"
        summary="Seiten mit offenen KI-Vorschlägen — links Original, rechts bearbeitbarer KI-Text."
      />

      {entries.length === 0 ? (
        <EmptyState
          title="Keine offenen Reviews"
          description="Wähle Seiten in Wiki / Seiten aus und starte eine KI-Aktion — die Ergebnisse erscheinen hier."
          action={
            <Link className="text-primary hover:underline" href={`/worlds/${worldSlug}`}>
              Zur Seitenübersicht
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium">Titel</th>
                <th className="px-3 py-2 font-medium">Typ</th>
                <th className="px-3 py-2 font-medium">KI-Aufgabe</th>
                <th className="px-3 py-2 font-medium">Geändert</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.pageId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Link href={entry.href} className="font-medium hover:underline">
                      {entry.pageTitle}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{entry.pageType}</td>
                  <td className="px-3 py-2">{entry.taskType}</td>
                  <td className="px-3 py-2">
                    {new Date(entry.updatedAt).toLocaleString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WorldShell>
  );
}
