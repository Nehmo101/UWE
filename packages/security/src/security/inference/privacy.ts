/**
 * Server-owned AI privacy primitives that carry no provider/settings coupling:
 * they operate purely on the {@link AiContext} shape and request flags. They live
 * in the low-level `@uwe/security` layer so the AI policy guards can use them
 * without importing the AI feature package. `@uwe/ai-brain/privacy` re-exports
 * these symbols, keeping existing consumers unchanged.
 *
 * Provider-coupled privacy logic (`validateProviderForContext` — depends on the
 * cloud/local provider taxonomy) stays in `@uwe/ai-brain`.
 */
import type { AiContext } from "./ai-context-types";

/** Server-owned allowDmOnly — never trust client-supplied flags for cloud routes. */
export function resolveServerAllowDmOnly(
  settings: { localOnly: boolean },
  routeIsCloud: boolean,
  playerSafe?: boolean,
): boolean {
  if (routeIsCloud || playerSafe) {
    return false;
  }
  return settings.localOnly;
}

export function sanitizeContextForCloud(context: AiContext): AiContext {
  const pages = context.pages
    .map((page) => {
      const contentBlocks = page.contentBlocks.filter((block) => block.visibility !== "dm_only");
      const includePage = page.visibility !== "dm_only" && contentBlocks.length > 0;

      if (!includePage && page.visibility === "dm_only") {
        return null;
      }

      return {
        ...page,
        contentBlocks: page.visibility === "dm_only" ? [] : contentBlocks,
      };
    })
    .filter((page): page is NonNullable<typeof page> => page !== null && page.contentBlocks.length > 0);

  const session = context.session
    ? {
        ...context.session,
        summaryDm: null,
        notes: null,
        openPlots: null,
        playerDecisions: null,
      }
    : undefined;

  return {
    ...context,
    pages,
    session,
    promptContext: serializeContextPages(pages, session),
  };
}

function serializeContextPages(
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
        `Sichtbarkeit: ${page.visibility}`,
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
