import type { LabelContentData, LabelLayoutSettings } from "./label-service";
import type { LabelElement } from "./label-elements";

export type LabelFitStatus = "fits" | "tight" | "overflow";
export type LabelFitMode = "conservative" | "normal" | "aggressive";

const FILLER_WORDS = new Set([
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einer",
  "eines",
  "und",
  "oder",
  "aber",
  "dass",
  "mit",
  "von",
  "zu",
  "im",
  "in",
  "am",
  "an",
  "auf",
  "für",
  "als",
  "auch",
  "noch",
  "sehr",
  "etwas",
  "eigentlich",
  "vielleicht",
]);

export interface LabelFitResult {
  fittedText: string;
  fitStatus: LabelFitStatus;
  fontSize: number;
  lineHeight: number;
  elementHeight?: number;
}

export interface LabelFitOptions {
  mode?: LabelFitMode;
  maxChars?: number;
  minFontSize?: number;
  maxFontSize?: number;
  elementWidthInches?: number;
  elementHeightInches?: number;
}

function estimateLines(
  text: string,
  charsPerLine: number,
): number {
  if (!text.trim()) return 0;
  const lines = text.split(/\r?\n/);
  return lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

function charsPerLineForWidth(widthInches: number, fontSize: number): number {
  return Math.max(12, Math.floor((widthInches * 72) / (fontSize * 0.55)));
}

function maxLinesForHeight(heightInches: number, fontSize: number, lineHeight: number): number {
  const linePx = fontSize * lineHeight;
  return Math.max(1, Math.floor((heightInches * 72) / linePx));
}

export function assessTextFit(
  text: string,
  options: LabelFitOptions = {},
): LabelFitResult {
  const mode = options.mode ?? "normal";
  const maxChars = options.maxChars ?? (mode === "conservative" ? 600 : mode === "aggressive" ? 1000 : 800);
  const minFontSize = options.minFontSize ?? (mode === "conservative" ? 9 : 7);
  const maxFontSize = options.maxFontSize ?? 14;
  const width = options.elementWidthInches ?? 5.6;
  const height = options.elementHeightInches ?? 1.2;

  let fontSize = maxFontSize;
  let lineHeight = 1.35;
  const original = text.trim();

  if (!original) {
    return { fittedText: "", fitStatus: "fits", fontSize, lineHeight };
  }

  if (original.length <= maxChars) {
    const cpl = charsPerLineForWidth(width, fontSize);
    const lines = estimateLines(original, cpl);
    const maxLines = maxLinesForHeight(height, fontSize, lineHeight);

    if (lines <= maxLines) {
      return { fittedText: original, fitStatus: "fits", fontSize, lineHeight };
    }
  }

  while (fontSize > minFontSize) {
    const cpl = charsPerLineForWidth(width, fontSize);
    const lines = estimateLines(original, cpl);
    const maxLines = maxLinesForHeight(height, fontSize, lineHeight);

    if (lines <= maxLines && original.length <= maxChars) {
      const status: LabelFitStatus = lines >= maxLines - 1 ? "tight" : "fits";
      return { fittedText: original, fitStatus: status, fontSize, lineHeight };
    }

    fontSize -= 0.5;
  }

  if (lineHeight > 1.15) {
    lineHeight = 1.15;
    const cpl = charsPerLineForWidth(width, fontSize);
    const lines = estimateLines(original, cpl);
    const maxLines = maxLinesForHeight(height, fontSize, lineHeight);
    if (lines <= maxLines) {
      return { fittedText: original, fitStatus: "tight", fontSize, lineHeight };
    }
  }

  let shortened = shortenText(original, mode, maxChars);
  const cpl = charsPerLineForWidth(width, fontSize);
  const lines = estimateLines(shortened, cpl);
  const maxLines = maxLinesForHeight(height, fontSize, lineHeight);

  if (lines > maxLines) {
    shortened = toBulletPoints(shortened, maxLines);
  }

  const fitStatus: LabelFitStatus =
    shortened.length < original.length * 0.7 ? "overflow" : "tight";

  return { fittedText: shortened, fitStatus, fontSize, lineHeight };
}

function shortenText(text: string, mode: LabelFitMode, maxChars: number): string {
  let result = text;

  if (mode !== "conservative") {
    result = result
      .split(/\s+/)
      .filter((word) => !FILLER_WORDS.has(word.toLowerCase().replace(/[.,;:!?]/g, "")))
      .join(" ");
  }

  if (mode === "aggressive") {
    result = result
      .replace(/\b(\w{4,})\w{3,}\b/g, "$1.")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (result.length > maxChars) {
    const sentences = result.split(/(?<=[.!?])\s+/);
    if (sentences.length > 1 && mode !== "conservative") {
      result = sentences.slice(0, Math.ceil(sentences.length / 2)).join(" ");
    }
  }

  if (result.length > maxChars) {
    result = `${result.slice(0, maxChars - 1).trim()}…`;
  }

  return result;
}

function toBulletPoints(text: string, maxLines: number): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 1) {
    return text;
  }

  return sentences
    .slice(0, maxLines)
    .map((sentence) => `• ${sentence.trim()}`)
    .join("\n");
}

export function applyAutoFitToContent(
  content: LabelContentData,
  layoutSettings: LabelLayoutSettings,
  elements?: LabelElement[],
): LabelContentData {
  const originalText = content.originalText ?? content.text;
  const textElement = elements?.find((el) => el.type === "text");
  const fit = assessTextFit(originalText, {
    mode: layoutSettings.fitMode ?? content.fitMode ?? "normal",
    maxChars: layoutSettings.maxChars,
    elementWidthInches: textElement?.width,
    elementHeightInches: textElement?.height,
  });

  const updatedElements = elements?.map((el) => {
    if (el.type !== "text") return el;
    return {
      ...el,
      text: fit.fittedText,
      style: {
        ...el.style,
        fontSize: fit.fontSize,
        lineHeight: fit.lineHeight,
      },
    };
  });

  return {
    ...content,
    originalText,
    text: fit.fittedText,
    fittedText: fit.fittedText,
    fitStatus: fit.fitStatus,
    fitApplied: true,
    fitMode: layoutSettings.fitMode ?? content.fitMode ?? "normal",
    elements: updatedElements ?? content.elements,
  };
}

export function restoreOriginalText(content: LabelContentData): LabelContentData {
  const original = content.originalText ?? content.text;
  const updatedElements = content.elements?.map((el) => {
    if (el.type === "text" || el.type === "title") {
      if (el.type === "text") {
        return { ...el, text: original };
      }
    }
    return el;
  });

  return {
    ...content,
    text: original,
    fittedText: undefined,
    fitStatus: "fits",
    fitApplied: false,
    elements: updatedElements,
  };
}

export const LABEL_FIT_STATUS_LABELS: Record<LabelFitStatus, string> = {
  fits: "Passt",
  tight: "Knapp",
  overflow: "Zu lang",
};
