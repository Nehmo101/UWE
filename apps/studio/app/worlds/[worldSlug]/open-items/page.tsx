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
import { OpenItemsBulkClose } from "@/components/worlds/OpenItemsBulkClose";
import { bulkCloseOpenQuestsAction } from "../open-items-actions";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

const CATEGORY_ORDER: WorldOpenItemCategory[] = [
  "open_quest",
  "session_plot",
  "played_awaiting_canon",
  "prepared_content",
  "draft_npc",
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
    <>
      <ShellBreadcrumb
        items={[
          { label: "Welten", href: "/worlds" },
          { label: world.name, href: `/worlds/${worldSlug}/dashboard` },
          { label: "Was ist offen?" },
        ]}
      />
      <PageHeader
        title="Was ist offen?"
        summary="Vereinheitlichte Übersicht: offene Quests, Session-Plots, vorbereitete und gespielte Inhalte, NPCs in Arbeit und Rätsel. Verworfene Seiten werden ausgeblendet."
      />

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine offenen Punkte gefunden — alles sieht erledigt aus.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <OpenItemsBulkClose
            worldSlug={worldSlug}
            items={items.map((item) => ({
              id: item.id,
              title: item.title,
              category: item.category,
            }))}
            action={bulkCloseOpenQuestsAction}
          />
          {CATEGORY_ORDER.map((category) => {
            const section = grouped[category];
            if (section.length === 0) {
              return null;
            }

            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{WORLD_OPEN_ITEM_CATEGORY_LABELS[category]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {section.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card p-3 text-sm text-card-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-muted"
                        >
                          <strong className="font-semibold text-foreground">{item.title}</strong>
                          <span className="text-xs text-muted-foreground">{item.meta}</span>
                          {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
