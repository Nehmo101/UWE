import type { EngineReadinessStatus } from "@uwe/ai-brain/router";
import { mapEngineReadinessToConnectorState, type EngineConnectorState } from "@uwe/shared-ui";

// Der Mapper liegt seit H10 in shared-ui — Brain braucht ihn für das
// Mail-Center. Re-Export, damit die Studio-Importe unverändert stimmen.
export { mapEngineReadinessToConnectorState };

export type EngineReadinessSourceLabel = "connector" | "inference";

export interface StudioEngineDisplayState {
  status: EngineReadinessStatus;
  connectorState: EngineConnectorState;
}

export function resolveEngineReadinessSourceLabel(status: EngineReadinessStatus): EngineReadinessSourceLabel {
  if (status.source === "connector") return "connector";
  return "inference";
}

export function engineReadinessSourceLabelDe(status: EngineReadinessStatus): string {
  switch (resolveEngineReadinessSourceLabel(status)) {
    case "connector":
      return "Maschinenraum";
    default:
      return "Direkt (Inference)";
  }
}

export function engineReadinessNextSteps(status: EngineReadinessStatus, inferenceEnabled: boolean): string[] {
  if (!status.urlAllowed) {
    return [
      status.publicExposureWarning ??
        "Maschinenraum-/Inference-URL ist öffentlich — private Heimnetz-IP verwenden.",
      "Keinen Cloudflare-Tunnel direkt zum Maschinenraum-Rechner legen.",
      "AI_INFERENCE_ALLOW_PUBLIC_URL=true nur bewusst für Tests setzen.",
    ];
  }
  if (!status.ready && inferenceEnabled) {
    if (status.source === "connector") {
      return [
        "Maschinenraum auf dem Rechner mit der Hardware starten (Desktop-Client oder pnpm connector:start).",
        "Token im Command Center unter Maschinenraum prüfen und Verbindung online melden.",
        "Brain-/Objekt-KI blockiert bei Maschinenraum offline — Allgemeiner Cloud-Chat bleibt möglich.",
      ];
    }
    return [
      "Prüfe, ob Ollama/LM Studio auf dem Maschinenraum-Rechner läuft (AI_INFERENCE_BASE_URL).",
      "Optional: Maschinenraum im Command Center einrichten.",
      "Brain-/Objekt-KI blockiert bei Maschinenraum offline — Allgemeiner Cloud-Chat bleibt möglich.",
    ];
  }
  return [];
}
