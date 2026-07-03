import { AiPrivacyError } from "../types";
import {
  CLOUD_ALLOWED_CONTEXT_MODES,
  LOCAL_ONLY_CONTEXT_MODES,
  type AiContextMode,
  type AiProviderMode,
  type AiResolvedRoute,
  AiRouterError,
} from "./types";

const CONTEXT_MODE_LABELS: Record<AiContextMode, string> = {
  general_chat: "Allgemeiner Chat",
  brain: "Brain-Wissen",
  current_object: "Aktuelles Objekt",
  current_object_plus_brain: "Objekt + Brain",
  personal_brain: "Persönliches Life-Brain",
  mail: "Private E-Mail",
};

const PROVIDER_MODE_LABELS: Record<AiProviderMode, string> = {
  auto: "Automatisch",
  local_rtx: "Lokale RTX",
  cloud: "Cloud",
};

export function contextModeRequiresLocalContext(contextMode: AiContextMode): boolean {
  return LOCAL_ONLY_CONTEXT_MODES.includes(contextMode);
}

export function isCloudRouteAllowedForContext(contextMode: AiContextMode): boolean {
  return CLOUD_ALLOWED_CONTEXT_MODES.includes(contextMode);
}

/**
 * Server-side validation of provider + context mode combinations.
 * Only personal_brain is permanently cloud-blocked.
 * DnD/world modes (brain, current_object, current_object_plus_brain) may go to
 * cloud when admin gateway policy allows (CLOUD_ALLOWED_CONTEXT_MODES).
 */
export function validateProviderContextCombination(
  providerMode: AiProviderMode,
  contextMode: AiContextMode,
): void {
  if (providerMode === "cloud" && !isCloudRouteAllowedForContext(contextMode)) {
    throw new AiPrivacyError(
      `Cloud-KI darf private Inhalte niemals erhalten. „${CONTEXT_MODE_LABELS[contextMode]}" ist lokal-exklusiv — kein Cloud-Routing erlaubt. Nutze lokale RTX.`,
    );
  }
}

/**
 * Validates resolved route against context mode (second line of defense after routing).
 * Only personal_brain is blocked on cloud route; DnD modes are allowed when policy permits.
 */
export function validateResolvedRouteForContext(
  route: AiResolvedRoute,
  contextMode: AiContextMode,
): void {
  if (route === "cloud" && !isCloudRouteAllowedForContext(contextMode)) {
    throw new AiPrivacyError(
      `Interner Datenschutzfehler: Cloud-Route für „${CONTEXT_MODE_LABELS[contextMode]}" blockiert. Lokal-exklusiver Kontext darf nicht an Cloud-Provider gesendet werden.`,
    );
  }
}

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
 * Enforces RTX requirement based on provider mode and context mode.
 * - Local-only modes (personal_brain, mail) in auto mode: always require RTX
 *   (no cloud fallback, privacy law).
 * - explicit local_rtx: requires RTX regardless of context.
 * - DnD/world modes (brain, current_object, …) in auto mode: RTX preferred,
 *   cloud fallback allowed when RTX is offline (handled by gateway policy).
 */
export function validateLocalRtxRequired(
  providerMode: AiProviderMode,
  contextMode: AiContextMode,
  rtxOnline: boolean,
): void {
  const needsRtx =
    providerMode === "local_rtx" ||
    (providerMode === "auto" && LOCAL_ONLY_CONTEXT_MODES.includes(contextMode));

  if (needsRtx && !rtxOnline) {
    const contextLabel = CONTEXT_MODE_LABELS[contextMode];
    throw new AiRouterError(
      providerMode === "local_rtx"
        ? `Lokale RTX-Inference ist nicht erreichbar. Bitte RTX-PC prüfen oder Provider auf „${PROVIDER_MODE_LABELS.auto}" setzen.`
        : `Für „${contextLabel}" ist lokale RTX erforderlich, aber RTX ist offline. Cloud-Fallback ist aus Datenschutzgründen nicht erlaubt.`,
    );
  }
}
