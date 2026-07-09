import type { PaletteColors, PaletteValidation } from "@uwe/theme-studio";

export type ThemeChatRole = "user" | "assistant";

export interface ThemeChatMessage {
  role: ThemeChatRole;
  content: string;
}

/** A palette candidate returned by the model, with its validation attached. */
export interface GeneratedPalette {
  label: string;
  description: string;
  colors: PaletteColors;
  validation: PaletteValidation;
}

export interface ThemeGeneratorTurnInput {
  /** Prior turns (excluding the latest user message). */
  history?: ThemeChatMessage[];
  /** The latest user message driving this turn. */
  userMessage: string;
  scope: "studio" | "portal" | "both";
  /** Max palette candidates to request (default 3). */
  variantCount?: number;
  /** Optional repair instruction appended to the prompt (from a prior invalid turn). */
  repairHint?: string;
}

export interface ThemeGeneratorTurnResult {
  /** The model's message to show the user (question or summary). */
  assistantMessage: string;
  /** Validated palette candidates (empty when the model asked a question). */
  palettes: GeneratedPalette[];
  /** True when no palettes were proposed (the model needs more input). */
  needsInput: boolean;
  /** Set when the response could not be parsed into the expected envelope. */
  parseError?: string;
  /** Raw model output (for debugging / logging). */
  raw: string;
}

/** Injected text-generation function — the caller wires this to the AI gateway. */
export type ThemeGenerateFn = (prompt: {
  system: string;
  user: string;
}) => Promise<string>;
