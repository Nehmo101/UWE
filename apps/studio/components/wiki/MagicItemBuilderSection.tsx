import {
  createLifeAdminService,
  createPrismaClient,
  getStructuredGeneratorSchema,
  listGeneratorActions,
  parseGeneratorPresetTemplate,
  resolveGeneratorContextFromPage,
  type PageType,
} from "@uwe/database/server";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import {
  MagicItemBuilderPanel,
  type MagicItemPresetOption,
} from "@/components/wiki/MagicItemBuilderPanel";

interface Props {
  worldSlug: string;
  pageSlug: string;
  pageTitle: string;
  pageType: string;
  pageId: string;
  worldId: string;
  rtxReady: boolean;
  rtxEnabled: boolean;
}

export async function MagicItemBuilderSection({
  worldSlug,
  pageSlug,
  pageTitle,
  pageType,
  pageId,
  worldId,
  rtxReady,
  rtxEnabled,
}: Props) {
  if (pageType !== "item") {
    return null;
  }

  const context = resolveGeneratorContextFromPage({
    pageId,
    pageType: pageType as PageType,
    pageTitle,
    worldId,
    worldSlug,
  });
  const action = listGeneratorActions(context).find((entry) => entry.id === "generate_item");
  if (!action) {
    return null;
  }

  const schema = getStructuredGeneratorSchema("item");

  const db = createPrismaClient();
  const lifeAdmin = createLifeAdminService(db);
  await lifeAdmin.ensureDefaultGeneratorPresets();
  const [systemPresets, worldPresets] = await Promise.all([
    lifeAdmin.listGeneratorPresets({ worldId: null, targetType: "item" }),
    lifeAdmin.listGeneratorPresets({ worldId, targetType: "item" }),
  ]);
  await db.$disconnect();

  const presets: MagicItemPresetOption[] = [...systemPresets, ...worldPresets].map((preset) => {
    const template = parseGeneratorPresetTemplate(preset.template);
    return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      fieldIds: template.fieldIds,
      defaults: template.defaults,
    };
  });

  return (
    <div id="item-structured-generator">
      <MagicItemBuilderPanel
        worldSlug={worldSlug}
        pageSlug={pageSlug}
        pageTitle={pageTitle}
        schema={schema}
        action={action}
        presets={presets}
        searchEquipmentUrl={studioApiUrl("/api/dnd/equipment/search")}
        rtxReady={rtxReady}
        rtxEnabled={rtxEnabled}
      />
    </div>
  );
}
