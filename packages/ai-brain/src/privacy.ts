import { isCloudProvider } from "./settings";
import type { AiContext, AiProviderId } from "./types";
import { AiPrivacyError } from "./types";

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

  if (isCloudProvider(providerId) && contextContainsDmOnly(context) && !context.allowDmOnly) {
    throw new AiPrivacyError(
      "Cloud-Provider dürfen keine DM-only-Inhalte erhalten. Aktiviere local-only oder erlaube DM-Inhalte ausdrücklich.",
    );
  }
}

export function sanitizeContextForCloud(context: AiContext): AiContext {
  if (context.allowDmOnly) {
    return context;
  }

  const pages = context.pages.map((page) => {
    const contentBlocks = page.contentBlocks.filter((block) => block.visibility !== "dm_only");
    const includePage = page.visibility !== "dm_only" && contentBlocks.length > 0;

    if (!includePage && page.visibility === "dm_only") {
      return null;
    }

    return {
      ...page,
      contentBlocks: page.visibility === "dm_only" ? [] : contentBlocks,
    };
  }).filter((page): page is NonNullable<typeof page> => page !== null && page.contentBlocks.length > 0);

  return {
    ...context,
    pages,
    promptContext: serializeContextPages(pages),
  };
}

function serializeContextPages(pages: AiContext["pages"]): string {
  return pages
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
}
