import {
  createPrismaClient,
  createStructuredStatblockService,
} from "@uwe/database/server";
import { StatblockStudioPanel } from "@/components/StatblockStudioPanel";

const DEFAULT_STATBLOCK = {
  name: "Beispiel-Kreatur",
  size: "Medium",
  type: "humanoid",
  alignment: "neutral",
  ac: 14,
  hp: 22,
  cr: "1",
  abilities: { str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 8 },
  traits: [{ name: "Beispiel", desc: "Kurzbeschreibung hier." }],
  actions: [{ name: "Angriff", desc: "+4 to hit, 1d8+2 Schaden." }],
};

interface Props {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
  pageType: string;
}

export async function StatblockStudioSection({
  worldSlug,
  pageId,
  pageSlug,
  category,
  pageType,
}: Props) {
  if (pageType !== "monster" && pageType !== "npc") {
    return null;
  }

  const db = createPrismaClient();
  const statblocks = createStructuredStatblockService(db);
  const existing = await statblocks.getByPageId(pageId);
  await db.$disconnect();

  const initialJson = JSON.stringify(existing?.data ?? DEFAULT_STATBLOCK, null, 2);

  return (
    <StatblockStudioPanel
      worldSlug={worldSlug}
      pageId={pageId}
      pageSlug={pageSlug}
      category={category}
      initialJson={initialJson}
      rulesEdition={existing?.rulesEdition ?? "dnd5e_2024"}
    />
  );
}
