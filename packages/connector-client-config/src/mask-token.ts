const MASKED_SHORT = "••••••••";
const VISIBLE_PREFIX = 8;
const MASK_SUFFIX = "•".repeat(8);

/**
 * Mask a connector token for UI display (never log or persist the masked form as auth).
 */
export function maskToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= VISIBLE_PREFIX + 3) {
    return MASKED_SHORT;
  }
  return `${trimmed.slice(0, VISIBLE_PREFIX)}${MASK_SUFFIX}`;
}
