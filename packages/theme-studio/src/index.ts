/**
 * @uwe/theme-studio — framework-agnostic palette domain logic for the
 * conversational design creator: the token schema, WCAG-contrast validation
 * gate, and LLM response parsing / repair hints. Consumed by `@uwe/ai-brain`
 * (generation) and the Studio wizard (validation before save).
 */
export {
  REQUIRED_PALETTE_KEYS,
  OPTIONAL_PALETTE_KEYS,
  ALL_PALETTE_KEYS,
  type PaletteColors,
  type PaletteKey,
  type RequiredPaletteKey,
  type OptionalPaletteKey,
} from "./palette-tokens";

export {
  AA_CONTRAST,
  AA_LARGE_CONTRAST,
  isHexColor,
  relativeLuminance,
  contrastRatio,
  bestOnColor,
} from "./contrast";

export {
  validatePalette,
  buildRepairHint,
  type PaletteValidation,
  type PaletteIssue,
  type PaletteIssueKind,
} from "./validate";

export {
  parsePaletteResponse,
  extractJsonObject,
  type ParsedPalette,
  type PaletteParseResult,
} from "./parse";
