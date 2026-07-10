import { isCloudProvider } from "./settings";
import type { AiContext, AiProviderId } from "./types";
import { AiPrivacyError } from "./types";

// Provider/settings-independent privacy primitives now live in the low-level
// `@uwe/security` layer; re-exported here so existing consumers are unchanged.
export {
  resolveServerAllowDmOnly,
  sanitizeContextForCloud,
} from "@uwe/security/inference";

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
  options: {
    datenschutzMode: boolean;
    localOnly: boolean;
    /**
     * When true, local campaign/brain context is allowed on the cloud route.
     * Set to true for DnD modes (brain, current_object, current_object_plus_brain)
     * when admin gateway policy is CLOUD_ALLOWED. personal_brain must never set this.
     * Defaults to false for backward-compatible behaviour.
     */
    allowLocalContextOnCloud?: boolean;
  },
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

  if (isCloudProvider(providerId) && !options.allowLocalContextOnCloud && contextContainsLocalKnowledge(context)) {
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
