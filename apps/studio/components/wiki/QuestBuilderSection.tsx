import {
  getAppRepository,
  getStructuredGeneratorSchema,
  listGeneratorActions,
  resolveGeneratorContextFromPage,
  type PageType,
} from "@uwe/database/server";
import { QuestBuilderPanel } from "@/components/wiki/QuestBuilderPanel";

interface Props {
  worldSlug: string;
  pageSlug: string;
  pageTitle: string;
  pageType: string;
  pageId: string;
  worldId: string;
  engineReady: boolean;
  engineEnabled: boolean;
}

export async function QuestBuilderSection({
  worldSlug,
  pageSlug,
  pageTitle,
  pageType,
  pageId,
  worldId,
  engineReady,
  engineEnabled,
}: Props) {
  if (pageType !== "quest") {
    return null;
  }

  const context = resolveGeneratorContextFromPage({
    pageId,
    pageType: pageType as PageType,
    pageTitle,
    worldId,
    worldSlug,
  });
  const action = listGeneratorActions(context).find((entry) => entry.id === "generate_quest");
  if (!action) {
    return null;
  }

  const schema = getStructuredGeneratorSchema("quest");
  const repo = getAppRepository();
  const npcs = await repo.listPagesByWorld(worldSlug, { type: "npc" });

  return (
    <QuestBuilderPanel
      worldSlug={worldSlug}
      pageSlug={pageSlug}
      pageTitle={pageTitle}
      schema={schema}
      action={action}
      npcOptions={npcs.map((npc) => ({ title: npc.title, slug: npc.slug }))}
      engineReady={engineReady}
      engineEnabled={engineEnabled}
    />
  );
}
