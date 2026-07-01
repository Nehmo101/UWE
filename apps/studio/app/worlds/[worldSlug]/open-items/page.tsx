import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createPrismaClient,
  createWorldOpenItemsService,
  getAppRepository,
  groupOpenItemsByCategory,
  WORLD_OPEN_ITEM_CATEGORY_LABELS,
  type WorldOpenItemCategory,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

const CATEGORY_ORDER: WorldOpenItemCategory[] = [
  "open_quest",
  "session_plot",
  "played_awaiting_canon",
  "prepared_content",
  "draft_npc",
  "open_puzzle",
];

export default async function WorldOpenItemsPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  const db = createPrismaClient();
  const service = createWorldOpenItemsService(db);
  const items = await service.listForWorld(worldSlug);
  await db.$disconnect();

  const grouped = groupOpenItemsByCategory(items);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Welten", href: "/worlds" },
            { label: world.name, href: `/worlds/${worldSlug}/dashboard` },
            { label: "Was ist offen?" },
          ]}
        />
      }
    >
      <PageHeader
        title="Was ist offen?"
        summary="Vereinheitlichte Übersicht: offene Quests, Session-Plots, vorbereitete und gespielte Inhalte, NPCs in Arbeit und Rätsel. Verworfene Seiten werden ausgeblendet."
      />

      {items.length === 0 ? (
        <p className="uwe-hint">Keine offenen Punkte gefunden — alles sieht erledigt aus.</p>
      ) : (
        CATEGORY_ORDER.map((category) => {
          const section = grouped[category];
          if (section.length === 0) {
            return null;
          }

          return (
            <section key={category} className="uwe-v2-card uwe-v2-section">
              <h2 className="uwe-v2-section-title">{WORLD_OPEN_ITEM_CATEGORY_LABELS[category]}</h2>
              <ul className="auth-page-list">
                {section.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href}>
                      <strong>{item.title}</strong>
                      <span className="auth-muted">{item.meta}</span>
                      {item.summary && <p className="portal-dash-summary">{item.summary}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </WorldShell>
  );
}
