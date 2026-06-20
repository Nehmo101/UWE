import type {
  AiFeatureCategory,
  AiGatewayConfigRecord,
  AiPrivacyLevel,
} from "@uwe/database/server";

export interface AiGatewaySimulationCase {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface GatewaySimulationInput {
  config: AiGatewayConfigRecord;
  rtxOnline: boolean;
  cloudProviders: Array<{ label: string; hasApiKey: boolean; isEnabled: boolean }>;
  budgetWithinLimit: boolean;
  privacyFeature: AiFeatureCategory;
  privacyLevel: AiPrivacyLevel;
  userCloudFallbackEnabled: boolean;
  simulateRtxOffline?: boolean;
}

function cloudBlockedByPrivacy(
  privacyFeature: AiFeatureCategory,
  privacyLevel: AiPrivacyLevel,
): boolean {
  return (
    privacyLevel === "CLOUD_FORBIDDEN" ||
    privacyLevel === "LOCAL_REQUIRED" ||
    privacyFeature === "personal_brain" ||
    privacyFeature === "dnd_world" ||
    privacyFeature === "private_notes"
  );
}

export function simulateGatewayRouting(input: GatewaySimulationInput): AiGatewaySimulationCase[] {
  const rtxOnline = input.simulateRtxOffline ? false : input.rtxOnline;
  const activeCloudProvider = input.cloudProviders.find((p) => p.isEnabled);
  const cases: AiGatewaySimulationCase[] = [];

  if (input.config.routingMode === "DISABLED") {
    cases.push({
      id: "disabled",
      label: "KI deaktiviert",
      passed: true,
      detail: "Routing-Modus DISABLED blockiert alle KI-Anfragen.",
    });
    return cases;
  }

  cases.push({
    id: "rtx_online_local",
    label: "RTX online → lokale KI wird genutzt",
    passed: rtxOnline,
    detail: rtxOnline
      ? "Lokale RTX-Inference wäre erreichbar und würde bevorzugt."
      : "RTX ist offline (simuliert oder real).",
  });

  const cloudAllowedByPrivacy = !cloudBlockedByPrivacy(input.privacyFeature, input.privacyLevel);

  const cloudAllowed =
    input.config.routingMode !== "LOCAL_ONLY" &&
    input.config.cloudFallbackEnabled &&
    cloudAllowedByPrivacy &&
    input.userCloudFallbackEnabled &&
    input.budgetWithinLimit;

  cases.push({
    id: "rtx_offline_cloud",
    label: "RTX offline → Cloud-Fallback, falls erlaubt",
    passed: !rtxOnline ? cloudAllowed && Boolean(activeCloudProvider?.hasApiKey) : true,
    detail: !rtxOnline
      ? cloudAllowed
        ? activeCloudProvider?.hasApiKey
          ? `Cloud-Provider „${activeCloudProvider.label}" würde als Fallback genutzt.`
          : "Cloud-Fallback erlaubt, aber kein Cloud-Provider mit API-Key."
        : "Cloud-Fallback nicht erlaubt (Routing, Privacy, User-Toggle oder Budget)."
      : "RTX ist online — Fallback nicht nötig.",
  });

  cases.push({
    id: "cloud_forbidden",
    label: "Geschützte Inhalte → Cloud blockiert",
    passed: cloudBlockedByPrivacy(input.privacyFeature, input.privacyLevel),
    detail: cloudBlockedByPrivacy(input.privacyFeature, input.privacyLevel)
      ? "Privacy-Regel blockiert Cloud für dieses Feature."
      : "Cloud wäre für dieses Feature erlaubt (Privacy-Regel).",
  });

  cases.push({
    id: "missing_key",
    label: "Cloud-Provider ohne API-Key → sauberer Fehler",
    passed: !activeCloudProvider || activeCloudProvider.hasApiKey,
    detail: activeCloudProvider?.hasApiKey
      ? "Cloud-Provider hat einen konfigurierten API-Key (maskiert)."
      : "Cloud-Provider ohne API-Key würde mit klarer Fehlermeldung blockiert.",
  });

  cases.push({
    id: "budget_exceeded",
    label: "Budget überschritten → Cloud blockiert",
    passed: input.budgetWithinLimit,
    detail: input.budgetWithinLimit
      ? "Budget nicht überschritten."
      : "Budget überschritten — Cloud-Fallback würde blockiert.",
  });

  return cases;
}
