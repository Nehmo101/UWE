import type { ImageProviderMode } from "./index";

/** Context modes for Image Studio prompt assembly. */
export type ImageStudioPromptContextMode =
  | "prompt_only"
  | "page_context"
  | "brain_context"
  | "object_context";

export const LOCAL_ONLY_IMAGE_CONTEXT_MODES: ImageStudioPromptContextMode[] = [
  "page_context",
  "brain_context",
  "object_context",
];

export const IMAGE_CONTEXT_MODE_LABELS: Record<ImageStudioPromptContextMode, string> = {
  prompt_only: "Nur Prompt (Cloud-sicher)",
  page_context: "Seiten-Kontext",
  brain_context: "Brain/Welt-Kontext",
  object_context: "Aktuelles Objekt",
};

export class ImageStudioPrivacyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageStudioPrivacyError";
  }
}

export function isCloudImageProvider(mode: ImageProviderMode): boolean {
  return mode === "cloud";
}

export function isLocalOnlyImageContext(mode: ImageStudioPromptContextMode): boolean {
  return LOCAL_ONLY_IMAGE_CONTEXT_MODES.includes(mode);
}

export function validateImageContextForProvider(
  providerMode: ImageProviderMode,
  contextMode: ImageStudioPromptContextMode,
  options?: { cloudContextApproved?: boolean },
): void {
  if (!isCloudImageProvider(providerMode)) return;

  if (isLocalOnlyImageContext(contextMode) && !options?.cloudContextApproved) {
    throw new ImageStudioPrivacyError(
      `Cloud-Bildgenerierung darf keinen privaten Kontext („${IMAGE_CONTEXT_MODE_LABELS[contextMode]}“) erhalten. Nutze lokale RTX oder wähle „Nur Prompt“.`,
    );
  }
}

export interface AssembleImagePromptInput {
  prompt: string;
  contextMode?: ImageStudioPromptContextMode;
  contextSnippet?: string | null;
  providerMode: ImageProviderMode;
  resolvedProvider: ImageProviderMode;
  cloudContextApproved?: boolean;
}

export interface AssembledImagePrompt {
  prompt: string;
  contextMode: ImageStudioPromptContextMode;
  contextIncluded: boolean;
  warnings: string[];
}

/**
 * Builds the final prompt sent to image providers.
 * Private world/brain/object context is stripped for cloud unless explicitly approved.
 */
export function assembleImageStudioPrompt(input: AssembleImagePromptInput): AssembledImagePrompt {
  const contextMode = input.contextMode ?? "prompt_only";
  const warnings: string[] = [];
  const snippet = input.contextSnippet?.trim() ?? "";

  if (
    isCloudImageProvider(input.resolvedProvider) &&
    isLocalOnlyImageContext(contextMode) &&
    !input.cloudContextApproved
  ) {
    if (snippet) {
      warnings.push("Privater Kontext wurde für Cloud-Provider entfernt.");
    }
    return {
      prompt: input.prompt.trim(),
      contextMode: "prompt_only",
      contextIncluded: false,
      warnings,
    };
  }

  if (isCloudImageProvider(input.providerMode) && isLocalOnlyImageContext(contextMode)) {
    validateImageContextForProvider(input.providerMode, contextMode, {
      cloudContextApproved: input.cloudContextApproved,
    });
  }

  if (isCloudImageProvider(input.resolvedProvider)) {
    return {
      prompt: input.prompt.trim(),
      contextMode: "prompt_only",
      contextIncluded: false,
      warnings,
    };
  }

  if (snippet && contextMode !== "prompt_only") {
    return {
      prompt: `${input.prompt.trim()}\n\n[Kontext: ${snippet}]`,
      contextMode,
      contextIncluded: true,
      warnings,
    };
  }

  return {
    prompt: input.prompt.trim(),
    contextMode,
    contextIncluded: false,
    warnings,
  };
}

/** Detects obvious private-data markers pasted into user prompts for cloud routes. */
export function scanPromptForPrivateDataLeak(prompt: string): string[] {
  const warnings: string[] = [];
  const patterns: Array<{ regex: RegExp; message: string }> = [
    { regex: /\[kontext:/i, message: "Eingebetteter Kontext-Block im Prompt" },
    { regex: /dm_only|player_visible/i, message: "Sichtbarkeits-Marker im Prompt" },
    { regex: /brain document|life-brain|welt-kontext/i, message: "Brain/Welt-Referenz im Prompt" },
    { regex: /secret level|geheimnis/i, message: "Geheimnis-Referenz im Prompt" },
  ];

  for (const { regex, message } of patterns) {
    if (regex.test(prompt)) {
      warnings.push(message);
    }
  }

  return warnings;
}
