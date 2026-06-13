import { isCloudProvider } from "./settings";
import type { AiContext, AiProviderId } from "./types";
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

export function contextContainsDmOnly(context: AiContext): boolean {
  return context.pages.some(
    (page) =>
      page.visibility === "dm_only" ||
      page.contentBlocks.some((block) => block.visibility === "dm_only"),
  );
}

export function validateProviderForContext(
  providerId: AiProviderId,
  context: AiContext,
  options: { datenschutzMode: boolean; localOnly: boolean },
): void {
  if (options.datenschutzMode && isCloudProvider(providerId)) {
    throw new AiPrivacyError(
      "Datenschutzmodus aktiv: Cloud-Provider dürfen keine Kampagnendaten erhalten.",
    );
  }

  if (options.localOnly && isCloudProvider(providerId)) {
    throw new AiPrivacyError(
      "Local-only-Modus aktiv: Nur lokale Provider sind erlaubt.",
    );
  }

  if (isCloudProvider(providerId) && contextContainsLocalKnowledge(context)) {
    throw new AiPrivacyError(
      "Cloud-Provider dürfen keinen lokalen Kampagnen-, Brain- oder Objekt-Kontext erhalten.",
    );
  }

  if (isCloudProvider(providerId) && contextContainsDmOnly(context)) {
    throw new AiPrivacyError(
      "Cloud-Provider dürfen keine DM-only-Inhalte erhalten.",
    );
  }
}

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

/** Extracts DM-only block contents from context for recap validation. */
export function extractDmOnlyPhrases(context: AiContext): string[] {
  const phrases: string[] = [];
  for (const page of context.pages) {
    for (const block of page.contentBlocks) {
      if (block.visibility === "dm_only" || block.type === "gm_note") {
        const snippet = block.content.trim().slice(0, 120);
        if (snippet.length > 10) {
          phrases.push(snippet);
        }
      }
    }
  }
  if (context.session?.summaryDm) phrases.push(context.session.summaryDm);
  if (context.session?.notes) phrases.push(context.session.notes);
  if (context.session?.openPlots) phrases.push(context.session.openPlots);
  return phrases;
}
