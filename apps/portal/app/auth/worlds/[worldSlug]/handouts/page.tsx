import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PageTypeBadge } from "@uwe/shared-ui";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { buildHandoutInbox } from "@uwe/player-hub";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";
import { PageHeader } from "@/src/components/shell";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export default async function PortalHandoutsPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const viewerId = ctx.previewAsUserId ?? ctx.user?.id ?? null;

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let inbox;
  try {
    const pages = await auth.listPagesForViewer(worldSlug, ctx);
    const handouts = pages.filter((page) => page.type === "handout");

    const unlocks = viewerId
      ? await db.sessionUnlock.findMany({
          where: {
            userId: viewerId,
            pageId: { in: handouts.map((page) => page.id) },
          },
          select: { pageId: true, unlockedAt: true, sessionLabel: true },
        })
      : [];

    inbox = buildHandoutInbox(handouts, unlocks);
  } finally {
    await db.$disconnect();
  }

  const newCount = inbox.filter((item) => item.isNew).length;

  return (
    <>
      <PageHeader
        title="Handout-Postfach"
        summary="In-Game-Briefe, Karten und Dokumente, die der Spielleiter für dich freigeschaltet hat."
        meta={
          newCount > 0 ? (
            <span className="text-sm font-medium text-primary">{newCount} neu seit den letzten Sessions</span>
          ) : null
        }
      />

      <ul className="grid gap-2">
        {inbox.map((item) => (
          <li key={item.page.id}>
            <Link
              href={`/auth/worlds/${worldSlug}/${item.page.slug}`}
              className="block rounded-[var(--radius)] border border-border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                {item.isNew ? (
                  <Sparkles className="size-4 text-primary" aria-label="Neu" />
                ) : null}
                {item.page.title}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <PageTypeBadge type={item.page.type} />
              </div>
              {item.unlockedAt ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Freigeschaltet {DATE_FORMAT.format(item.unlockedAt)}
                  {item.sessionLabel ? ` · ${item.sessionLabel}` : ""}
                </p>
              ) : null}
              {item.page.summary ? (
                <p className="mt-1 text-sm text-muted-foreground">{item.page.summary}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      {inbox.length === 0 ? (
        <PortalEmptyState title="Keine Handouts freigeschaltet" icon="mail" />
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
