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
 * Cloud must never receive local campaign/object/brain context.
 */
export function validateProviderContextCombination(
  providerMode: AiProviderMode,
  contextMode: AiContextMode,
): void {
  if (providerMode === "cloud" && !isCloudRouteAllowedForContext(contextMode)) {
    throw new AiPrivacyError(
      `Cloud-KI darf keinen lokalen Kontext erhalten. Modus „${CONTEXT_MODE_LABELS[contextMode]}“ ist mit Provider „${PROVIDER_MODE_LABELS.cloud}“ nicht erlaubt. Nutze lokale RTX oder wähle „Allgemeiner Chat“.`,
    );
  }
}

/** Validates resolved route against context mode (second line of defense after routing). */
export function validateResolvedRouteForContext(
  route: AiResolvedRoute,
  contextMode: AiContextMode,
): void {
  if (route === "cloud" && !isCloudRouteAllowedForContext(contextMode)) {
    throw new AiPrivacyError(
      `Interner Datenschutzfehler: Cloud-Route für „${CONTEXT_MODE_LABELS[contextMode]}“ blockiert. Lokaler Kontext darf nicht an Cloud-Provider gesendet werden.`,
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
      `Kontextmodus „${CONTEXT_MODE_LABELS[contextMode]}“ erfordert eine Seite (pageSlug).`,
    );
  }
}

export function validateLocalRtxRequired(
  providerMode: AiProviderMode,
  contextMode: AiContextMode,
  rtxOnline: boolean,
): void {
  const needsRtx =
    providerMode === "local_rtx" ||
    (providerMode === "auto" && contextModeRequiresLocalContext(contextMode));

  if (needsRtx && !rtxOnline) {
    const contextLabel = CONTEXT_MODE_LABELS[contextMode];
    throw new AiRouterError(
      providerMode === "local_rtx"
        ? "Lokale RTX-Inference ist nicht erreichbar. Bitte RTX-PC prüfen oder Provider auf „Automatisch“/„Cloud“ setzen (nur für Allgemeiner Chat)."
        : `Für „${contextLabel}“ ist lokale RTX erforderlich, aber RTX ist offline. Cloud-Fallback ist aus Datenschutzgründen nicht erlaubt.`,
    );
  }
}
