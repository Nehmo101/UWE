/**
 * Serializes an {@link AiContext} into the prompt text the local model sees.
 *
 * This module used to hold the DM-only sanitizer that stripped context before
 * it left for a cloud provider. There is no cloud provider left (every AI
 * action runs on the RTX host) and no dm_only marker left to strip, so all
 * that remains is the serialization.
 */
import type { AiContext } from "./ai-context-types";

export function serializeContextPages(
  pages: AiContext["pages"],
  session?: AiContext["session"],
): string {
  const sessionBlock = session
    ? [
        `# Session: ${session.title} (${session.sessionId})`,
        `Nummer: ${session.sessionNumber}`,
        session.summaryPlayer ? `Spieler-Recap (bisher): ${session.summaryPlayer}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const pageContext = pages
    .map((page) => {
      const blocks = page.contentBlocks.map((b) => `[${b.type}] ${b.content}`).join("\n");
      return [
        `## ${page.title} (${page.pageId})`,
        `Typ: ${page.pageType}`,
        `Kanon: ${page.canonicalStatus}`,
        page.summary ? `Zusammenfassung: ${page.summary}` : "",
        page.tags.length ? `Tags: ${page.tags.join(", ")}` : "",
        page.aliases.length ? `Aliase: ${page.aliases.join(", ")}` : "",
        blocks,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return [sessionBlock, pageContext].filter(Boolean).join("\n\n");
}
