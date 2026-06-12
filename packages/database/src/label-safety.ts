import type { LabelContentData } from "./label-service";
import type { LabelElement } from "./label-elements";

export interface LabelSafetyWarning {
  code: "dm_only" | "unrevealed_secret" | "dm_only_image" | "mixed_content";
  message: string;
  fixAction?: "remove_dm" | "replace_secret" | "remove_image" | "export_dm";
}

export interface LabelSafetyReport {
  warnings: LabelSafetyWarning[];
  canExportPlayer: boolean;
  canExportDm: boolean;
}

export function analyzeLabelSafety(
  content: LabelContentData,
  elements?: LabelElement[],
): LabelSafetyReport {
  const warnings: LabelSafetyWarning[] = [];
  const els = elements ?? content.elements ?? [];

  if (content.containsDmOnly || (content.dmOnlyBlockCount ?? 0) > 0) {
    warnings.push({
      code: "dm_only",
      message: "Dieses Label enthält DM-only Informationen.",
      fixAction: "remove_dm",
    });
  }

  const dmOnlyElements = els.filter((el) => el.dmOnly && el.visible);
  if (dmOnlyElements.length > 0) {
    warnings.push({
      code: "mixed_content",
      message: `${dmOnlyElements.length} Element(e) sind als DM-only markiert.`,
      fixAction: "remove_dm",
    });
  }

  const dmImages = els.filter(
    (el) => el.type === "image" && el.visible && el.dmOnly,
  );
  if (dmImages.length > 0) {
    warnings.push({
      code: "dm_only_image",
      message: "Dieses Bild ist nicht player-visible.",
      fixAction: "remove_image",
    });
  }

  if (content.imageAssetId && content.containsDmOnly) {
    warnings.push({
      code: "dm_only_image",
      message: "Bild gehört zu gemischtem oder DM-only Content.",
      fixAction: "remove_image",
    });
  }

  return {
    warnings,
    canExportPlayer: warnings.length === 0,
    canExportDm: true,
  };
}

export function stripDmOnlyForPlayer(content: LabelContentData): LabelContentData {
  const elements = content.elements?.map((el) => {
    if (el.dmOnly) {
      return { ...el, visible: false };
    }
    return el;
  });

  return {
    ...content,
    elements,
    containsDmOnly: false,
    dmOnlyBlockCount: 0,
    text: content.text,
    imageAssetId: content.containsDmOnly ? null : content.imageAssetId,
  };
}

export function removeDmOnlyElements(content: LabelContentData): LabelContentData {
  const elements = content.elements?.filter((el) => !el.dmOnly);
  return {
    ...content,
    elements,
    containsDmOnly: false,
    dmOnlyBlockCount: 0,
  };
}

export function removeImagesFromContent(content: LabelContentData): LabelContentData {
  const elements = content.elements?.map((el) => {
    if (el.type === "image") {
      return { ...el, visible: false, imageAssetId: null };
    }
    return el;
  });

  return {
    ...content,
    elements,
    imageAssetId: null,
  };
}
