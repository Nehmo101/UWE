import { ItemBuilderPanel } from "@/components/wiki/ItemBuilderPanel";
import { applySrdEquipmentToItemAction } from "@/app/worlds/[worldSlug]/item-builder-actions";
import { studioApiUrl } from "@/src/lib/studio-api-url";

interface Props {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
  pageTitle: string;
  pageSummary: string | null;
}

export function ItemBuilderSection({
  worldSlug,
  pageId,
  pageSlug,
  category,
  pageTitle,
  pageSummary,
}: Props) {
  return (
    <ItemBuilderPanel
      worldSlug={worldSlug}
      pageId={pageId}
      pageSlug={pageSlug}
      category={category}
      pageTitle={pageTitle}
      pageSummary={pageSummary}
      searchEquipmentUrl={studioApiUrl("/api/dnd/equipment/search")}
      applyEquipmentAction={applySrdEquipmentToItemAction}
    />
  );
}
