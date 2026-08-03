import {
  getStructuredGeneratorSchema,
  isStructuredGeneratorTarget,
  listGeneratorActions,
  resolveGeneratorContextFromPage,
  type PageType,
} from "@uwe/database/server";
import { StructuredGeneratorPanel } from "@/components/StructuredGeneratorPanel";

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

export async function StructuredGeneratorSection({
  worldSlug,
  pageSlug,
  pageTitle,
  pageType,
  pageId,
  worldId,
  engineReady,
  engineEnabled,
}: Props) {
  if (!isStructuredGeneratorTarget(pageType)) {
    return null;
  }

  const context = resolveGeneratorContextFromPage({
    pageId,
    pageType: pageType as PageType,
    pageTitle,
    worldId,
    worldSlug,
  });
  const actions = listGeneratorActions(context);
  const structuredActionId =
    pageType === "npc"
      ? "generate_npc"
      : pageType === "quest"
        ? "generate_quest"
        : "generate_item";
  const action = actions.find((entry) => entry.id === structuredActionId);
  if (!action) {
    return null;
  }

  const schema = getStructuredGeneratorSchema(pageType);

  return (
    <div id={pageType === "item" ? "item-structured-generator" : undefined}>
      <StructuredGeneratorPanel
        worldSlug={worldSlug}
        pageSlug={pageSlug}
        pageTitle={pageTitle}
        schema={schema}
        action={action}
        engineReady={engineReady}
        engineEnabled={engineEnabled}
      />
    </div>
  );
}
