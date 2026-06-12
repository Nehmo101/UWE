import type { LabelContentData, LabelLayoutMode, LabelLayoutSettings } from "./label-service";

export type LabelElementType =
  | "title"
  | "text"
  | "image"
  | "box"
  | "divider"
  | "icon"
  | "qr";

export interface LabelElementStyle {
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  color?: string;
  backgroundColor?: string;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  opacity?: number;
  /** Image crop: focus X 0–100 % */
  cropFocusX?: number;
  /** Image crop: focus Y 0–100 % */
  cropFocusY?: number;
  /** Image crop: zoom 100 = full frame */
  cropZoom?: number;
}

export interface LabelElement {
  id: string;
  type: LabelElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked?: boolean;
  visible: boolean;
  dmOnly?: boolean;
  text?: string;
  imageAssetId?: string | null;
  imageAlt?: string;
  url?: string;
  style?: LabelElementStyle;
}

export const LABEL_CANVAS_WIDTH = 6;
export const LABEL_CANVAS_HEIGHT = 4;
export const LABEL_SAFE_MARGIN = 0.2;

let elementCounter = 0;

export function createElementId(prefix = "el"): string {
  elementCounter += 1;
  return `${prefix}_${Date.now()}_${elementCounter}`;
}

export function defaultElementsForMode(
  content: LabelContentData,
  mode: LabelLayoutMode,
): LabelElement[] {
  const elements: LabelElement[] = [];
  const m = LABEL_SAFE_MARGIN;

  if (mode !== "image_only") {
    elements.push({
      id: createElementId("title"),
      type: "title",
      x: m,
      y: m,
      width: LABEL_CANVAS_WIDTH - m * 2,
      height: 0.45,
      zIndex: 1,
      visible: true,
      text: content.title || "Titel",
      style: { fontSize: 14, fontWeight: "bold", textAlign: "left", lineHeight: 1.2 },
    });
  }

  if (mode === "image_text") {
    elements.push({
      id: createElementId("img"),
      type: "image",
      x: m,
      y: 0.75,
      width: LABEL_CANVAS_WIDTH - m * 2,
      height: 1.8,
      zIndex: 2,
      visible: true,
      imageAssetId: content.imageAssetId ?? null,
      imageAlt: content.title,
    });
    elements.push({
      id: createElementId("text"),
      type: "text",
      x: m,
      y: 2.65,
      width: LABEL_CANVAS_WIDTH - m * 2,
      height: LABEL_CANVAS_HEIGHT - 2.85,
      zIndex: 3,
      visible: true,
      text: content.text || "",
      style: { fontSize: 10, textAlign: "left", lineHeight: 1.35 },
    });
  } else if (mode === "text_only") {
    elements.push({
      id: createElementId("text"),
      type: "text",
      x: m,
      y: 0.75,
      width: LABEL_CANVAS_WIDTH - m * 2,
      height: LABEL_CANVAS_HEIGHT - 0.95,
      zIndex: 2,
      visible: true,
      text: content.text || "",
      style: { fontSize: 11, textAlign: "left", lineHeight: 1.35 },
    });
  } else if (mode === "image_only") {
    elements.push({
      id: createElementId("img"),
      type: "image",
      x: m,
      y: m,
      width: LABEL_CANVAS_WIDTH - m * 2,
      height: LABEL_CANVAS_HEIGHT - m * 2,
      zIndex: 1,
      visible: true,
      imageAssetId: content.imageAssetId ?? null,
      imageAlt: content.title,
    });
  }

  return elements;
}

export function parseElements(raw: unknown): LabelElement[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is LabelElement => {
    return (
      item != null &&
      typeof item === "object" &&
      typeof (item as LabelElement).id === "string" &&
      typeof (item as LabelElement).type === "string"
    );
  });
}

export function ensureLabelElements(
  content: LabelContentData,
  layoutSettings: LabelLayoutSettings,
): LabelElement[] {
  if (content.elements && content.elements.length > 0) {
    return content.elements;
  }

  if (layoutSettings.elements && layoutSettings.elements.length > 0) {
    return layoutSettings.elements.map((element) => ({
      ...element,
      id: createElementId("tpl"),
      text:
        element.type === "title"
          ? content.title
          : element.type === "text"
            ? content.text
            : element.text,
      imageAssetId:
        element.type === "image" ? content.imageAssetId ?? element.imageAssetId : element.imageAssetId,
    }));
  }

  return defaultElementsForMode(content, layoutSettings.mode);
}

export function syncContentFromElements(
  content: LabelContentData,
  elements: LabelElement[],
): LabelContentData {
  const titleEl = elements.find((el) => el.type === "title" && el.visible);
  const textEl = elements.find((el) => el.type === "text" && el.visible);
  const imageEl = elements.find((el) => el.type === "image" && el.visible);

  return {
    ...content,
    elements,
    editorMode: "visual",
    title: titleEl?.text ?? content.title,
    text: textEl?.text ?? content.text,
    imageAssetId: imageEl?.imageAssetId ?? content.imageAssetId,
  };
}

export function duplicateElement(element: LabelElement): LabelElement {
  return {
    ...element,
    id: createElementId(element.type),
    x: Math.min(element.x + 0.1, LABEL_CANVAS_WIDTH - element.width),
    y: Math.min(element.y + 0.1, LABEL_CANVAS_HEIGHT - element.height),
  };
}

export function snapValue(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function clampElementToCanvas(element: LabelElement): LabelElement {
  const x = Math.max(0, Math.min(element.x, LABEL_CANVAS_WIDTH - 0.1));
  const y = Math.max(0, Math.min(element.y, LABEL_CANVAS_HEIGHT - 0.1));
  const width = Math.max(0.1, Math.min(element.width, LABEL_CANVAS_WIDTH - x));
  const height = Math.max(0.1, Math.min(element.height, LABEL_CANVAS_HEIGHT - y));
  return { ...element, x, y, width, height };
}
