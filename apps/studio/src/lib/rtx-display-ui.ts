import type { RtxReadinessStatus } from "@uwe/ai-brain/router";
import { mapRtxReadinessToConnectorState, type RtxConnectorState } from "@uwe/shared-ui";

// Der Mapper liegt seit H10 in shared-ui — Brain braucht ihn für das
// Mail-Center. Re-Export, damit die Studio-Importe unverändert stimmen.
export { mapRtxReadinessToConnectorState };

export type RtxReadinessSourceLabel = "connector" | "inference";

export interface StudioRtxDisplayState {
  status: RtxReadinessStatus;
  connectorState: RtxConnectorState;
}

export function resolveRtxReadinessSourceLabel(status: RtxReadinessStatus): RtxReadinessSourceLabel {
  if (status.source === "connector") return "connector";
  return "inference";
}

export function rtxReadinessSourceLabelDe(status: RtxReadinessStatus): string {
  switch (resolveRtxReadinessSourceLabel(status)) {
    case "connector":
      return "Maschinenraum";
    default:
      return "Direkt (Inference)";
  }
}

export function rtxReadinessNextSteps(status: RtxReadinessStatus, inferenceEnabled: boolean): string[] {
  if (!status.urlAllowed) {
    return [
      status.publicExposureWarning ??
        "RTX-/Inference-URL ist öffentlich — private Heimnetz-IP verwenden.",
      "Keinen Cloudflare-Tunnel direkt zum RTX-Rechner legen.",
      "AI_INFERENCE_ALLOW_PUBLIC_URL=true nur bewusst für Tests setzen.",
    ];
  }
  if (!status.ready && inferenceEnabled) {
    if (status.source === "connector") {
      return [
        "Maschinenraum auf dem RTX-Rechner starten (Desktop-Client oder pnpm connector:start).",
        "Token im Command Center unter Maschinenraum prüfen und Verbindung online melden.",
        "Brain-/Objekt-KI blockiert bei RTX offline — Allgemeiner Cloud-Chat bleibt möglich.",
      ];
    }
    return [
      "Prüfe, ob Ollama/LM Studio auf dem RTX-Rechner läuft (AI_INFERENCE_BASE_URL).",
      "Optional: Maschinenraum im Command Center einrichten.",
      "Brain-/Objekt-KI blockiert bei RTX offline — Allgemeiner Cloud-Chat bleibt möglich.",
    ];
  }
  return [];
}
