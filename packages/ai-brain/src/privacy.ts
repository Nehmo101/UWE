import type { AiContext } from "./types";
import { AiPrivacyError } from "./types";

/** True when context carries any UWE campaign/brain/object knowledge. */
export function contextContainsLocalKnowledge(context: AiContext): boolean {
  return (
    context.pages.length > 0 ||
    (context.brainEntries?.length ?? 0) > 0 ||
    Boolean(context.session) ||
    Boolean(context.campaign) ||
    Boolean(context.world?.description?.trim()) ||
    Boolean(context.promptContext?.trim()) ||
    context.sources.length > 0
  );
}

/** Checks that player-facing recap text does not leak known GM-only phrases. */
export function validatePlayerRecapContent(
  content: string,
  forbiddenPhrases: string[],
): void {
  const normalized = content.toLowerCase();
  for (const phrase of forbiddenPhrases) {
    if (phrase && normalized.includes(phrase.toLowerCase())) {
      throw new AiPrivacyError(
        `Spieler-Recap enthält mögliche GM-Geheimnisse: „${phrase.slice(0, 60)}…"`,
      );
    }
  }
}

/**
 * Extracts GM-only session text from the context for recap validation.
 *
 * Content blocks no longer contribute: with visibility gone there is no
 * dm_only block and no gm_note type. What is left is the session's own DM
 * fields, which a player-facing recap still must not echo verbatim.
 */
export function extractDmOnlyPhrases(context: AiContext): string[] {
  const phrases: string[] = [];
  if (context.session?.summaryDm) phrases.push(context.session.summaryDm);
  if (context.session?.notes) phrases.push(context.session.notes);
  if (context.session?.openPlots) phrases.push(context.session.openPlots);
  return phrases;
}
