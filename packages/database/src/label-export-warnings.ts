import type { LabelContentData, LabelLayoutSettings } from "./label-service";
import { ensureLabelElements } from "./label-elements";

export interface LabelExportWarning {
  code: "text_overflow" | "small_font" | "hidden_element" | "dm_only";
  message: string;
}

const MIN_FONT_WARNING = 7;

export function analyzeLabelExportWarnings(
  content: LabelContentData,
  layoutSettings: LabelLayoutSettings,
): LabelExportWarning[] {
  const warnings: LabelExportWarning[] = [];
  const elements = ensureLabelElements(content, layoutSettings);

  if (content.fitStatus === "overflow" || content.fitApplied) {
    warnings.push({
      code: "text_overflow",
      message:
        content.fitApplied
          ? "Text wurde gekürzt — Spieler-Version vor dem Druck prüfen."
          : "Text passt möglicherweise nicht vollständig auf das Label.",
    });
  }

  for (const element of elements) {
    if (!element.visible) {
      warnings.push({
        code: "hidden_element",
        message: `Element „${element.type}“ ist ausgeblendet und erscheint nicht im Export.`,
      });
      continue;
    }

    if (
      (element.type === "title" || element.type === "text") &&
      (element.style?.fontSize ?? (element.type === "title" ? 14 : 10)) < MIN_FONT_WARNING
    ) {
      warnings.push({
        code: "small_font",
        message: `Sehr kleine Schrift (${element.style?.fontSize ?? "?"} pt) bei ${element.type}-Element.`,
      });
    }

    if (element.dmOnly) {
      warnings.push({
        code: "dm_only",
        message: `DM-only Element (${element.type}) — nur in DM-Export sichtbar.`,
      });
    }
  }

  return warnings;
}
