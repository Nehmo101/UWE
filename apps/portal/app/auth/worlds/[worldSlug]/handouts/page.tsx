import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTypeBadge } from "@uwe/shared-ui";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { buildHandoutInbox } from "@uwe/player-hub";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";

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
    <section className="portal-content-card">
      <h1>Handout-Postfach</h1>
      <p className="auth-lead">
        In-Game-Briefe, Karten und Dokumente, die der Spielleiter für dich freigeschaltet hat.
        {newCount > 0 && (
          <>
            {" "}
            <strong>{newCount} neu</strong> seit den letzten Sessions.
          </>
        )}
      </p>

      <ul className="auth-page-list">
        {inbox.map((item) => (
          <li key={item.page.id}>
            <Link href={`/auth/worlds/${worldSlug}/${item.page.slug}`}>
              <strong>
                {item.isNew && <span aria-label="Neu">🆕 </span>}
                {item.page.title}
              </strong>
              <span className="auth-page-list-badges">
                <PageTypeBadge type={item.page.type} />
              </span>
              {item.unlockedAt && (
                <p className="portal-dash-summary">
                  Freigeschaltet {DATE_FORMAT.format(item.unlockedAt)}
                  {item.sessionLabel ? ` · ${item.sessionLabel}` : ""}
                </p>
              )}
              {item.page.summary && <p className="portal-dash-summary">{item.page.summary}</p>}
            </Link>
          </li>
        ))}
      </ul>

      {inbox.length === 0 && (
        <PortalEmptyState title="Keine Handouts freigeschaltet" icon="mail" />
      )}

      <p className="auth-muted">
        Bilder und Karten findest du zusätzlich in der{" "}
        <Link href={`/auth/worlds/${worldSlug}/assets`}>Galerie</Link>.
      </p>
    </section>
  );
}
