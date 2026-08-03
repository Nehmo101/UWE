/** Kontext-Modi beim Zusammenbauen eines Image-Studio-Prompts. */
export type ImageStudioPromptContextMode =
  | "prompt_only"
  | "page_context"
  | "brain_context"
  | "object_context";

/**
 * Kontexte, die private Inhalte mitschicken.
 *
 * Solange der einzige Weg der lokale Maschinenraum-Host ist, verlässt keiner davon das
 * Haus — die Unterscheidung bleibt trotzdem, weil sie beschreibt, *was* im
 * Prompt steht, und weil ein zweiter Weg sonst unbemerkt privaten Kontext
 * mitnehmen könnte.
 */
export const LOCAL_ONLY_IMAGE_CONTEXT_MODES: ImageStudioPromptContextMode[] = [
  "page_context",
  "brain_context",
  "object_context",
];

export const IMAGE_CONTEXT_MODE_LABELS: Record<ImageStudioPromptContextMode, string> = {
  prompt_only: "Nur Prompt",
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

export function isLocalOnlyImageContext(mode: ImageStudioPromptContextMode): boolean {
  return LOCAL_ONLY_IMAGE_CONTEXT_MODES.includes(mode);
}

export interface AssembleImagePromptInput {
  prompt: string;
  contextMode?: ImageStudioPromptContextMode;
  contextSnippet?: string | null;
}

export interface AssembledImagePrompt {
  prompt: string;
  contextMode: ImageStudioPromptContextMode;
  contextIncluded: boolean;
  warnings: string[];
}

/**
 * Baut den Prompt, der an den Maschinenraum-Host geht. Kontext wird angehängt, wenn einer
 * gewählt ist und ein Textausschnitt vorliegt — sonst bleibt es beim Prompt.
 */
export function assembleImageStudioPrompt(input: AssembleImagePromptInput): AssembledImagePrompt {
  const contextMode = input.contextMode ?? "prompt_only";
  const snippet = input.contextSnippet?.trim() ?? "";

  if (snippet && contextMode !== "prompt_only") {
    return {
      prompt: `${input.prompt.trim()}\n\n[Kontext: ${snippet}]`,
      contextMode,
      contextIncluded: true,
      warnings: [],
    };
  }

  return {
    prompt: input.prompt.trim(),
    contextMode,
    contextIncluded: false,
    warnings: [],
  };
}

/**
 * Findet offensichtliche Marker privater Daten in einem Prompt.
 *
 * Bleibt als Diagnose erhalten, obwohl kein Prompt mehr das Haus verlässt: die
 * Meldung hilft beim Nachvollziehen, was in einem Prompt gelandet ist.
 */
export function scanPromptForPrivateDataLeak(prompt: string): string[] {
  const warnings: string[] = [];
  const patterns: Array<{ regex: RegExp; message: string }> = [
    { regex: /\[kontext:/i, message: "Eingebetteter Kontext-Block im Prompt" },
    { regex: /brain document|life-brain|welt-kontext/i, message: "Brain/Welt-Referenz im Prompt" },
  ];

  for (const { regex, message } of patterns) {
    if (regex.test(prompt)) {
      warnings.push(message);
    }
  }

  return warnings;
}
