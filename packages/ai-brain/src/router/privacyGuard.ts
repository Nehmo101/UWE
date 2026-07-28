import { type AiContextMode, AiRouterError } from "./types";

/**
 * Context guard for AI requests.
 *
 * This module used to enforce the local-vs-cloud privacy rules: which context
 * modes were allowed to leave the host, and which were permanently pinned to
 * local inference. That whole question disappeared when cloud providers were
 * removed — every AI action in UWE runs on the RTX host, so there is no route
 * to police. A signpost is unnecessary once the road is gone.
 *
 * What remains are the two checks that were never about privacy: a context mode
 * must get the input it needs, and the RTX host must actually be reachable.
 */

const CONTEXT_MODE_LABELS: Record<AiContextMode, string> = {
  general_chat: "Allgemeiner Chat",
  brain: "Brain-Wissen",
  current_object: "Aktuelles Objekt",
  current_object_plus_brain: "Objekt + Brain",
  personal_brain: "Persönliches Life-Brain",
  mail: "Private E-Mail",
};

export function contextModeLabel(contextMode: AiContextMode): string {
  return CONTEXT_MODE_LABELS[contextMode];
}

/** Object-scoped context modes need a page to work with. */
export function validateContextModeRequirements(
  contextMode: AiContextMode,
  pageSlug?: string,
): void {
  const needsPage =
    contextMode === "current_object" || contextMode === "current_object_plus_brain";

  if (needsPage && !pageSlug?.trim()) {
    throw new AiRouterError(
      `Kontextmodus „${CONTEXT_MODE_LABELS[contextMode]}" erfordert eine Seite (pageSlug).`,
    );
  }
}

/**
 * The RTX host is the only backend. When it is offline there is nothing to fall
 * back to, so every request fails fast with a message that points at the cause.
 */
export function validateLocalRtxRequired(contextMode: AiContextMode, rtxOnline: boolean): void {
  if (rtxOnline) {
    return;
  }

  throw new AiRouterError(
    `Lokale RTX-Inference ist nicht erreichbar — „${CONTEXT_MODE_LABELS[contextMode]}" kann nicht ausgeführt werden. Bitte den RTX-Host prüfen.`,
  );
}
