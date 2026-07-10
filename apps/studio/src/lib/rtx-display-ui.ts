import type { RtxReadinessStatus } from "@uwe/ai-brain/router";
import type { RtxConnectorState } from "@uwe/shared-ui";

export type RtxReadinessSourceLabel = "connector" | "inference";

export interface StudioRtxDisplayState {
  status: RtxReadinessStatus;
  connectorState: RtxConnectorState;
}

/** Map unified RTX readiness to the shared UI badge state. */
export function mapRtxReadinessToConnectorState(status: RtxReadinessStatus): RtxConnectorState {
  if (status.agentStatus === "disabled" && !status.ready) {
    return "disabled";
  }
  if (status.connectorDegraded && status.ready) {
    return "starting";
  }
  if (status.ready) {
    return "online";
  }
  if (status.agentStatus === "starting") {
    return "starting";
  }
  if (status.agentStatus === "error" || !status.urlAllowed) {
    return "error";
  }
  return "offline";
}

export function resolveRtxReadinessSourceLabel(status: RtxReadinessStatus): RtxReadinessSourceLabel {
  if (status.source === "connector") return "connector";
  return "inference";
}

export function rtxReadinessSourceLabelDe(status: RtxReadinessStatus): string {
  switch (resolveRtxReadinessSourceLabel(status)) {
    case "connector":
      return "RTX Host Connector";
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
        "RTX Host Connector auf dem RTX-Rechner starten (Desktop-Client oder pnpm connector:start).",
        "Token unter System → RTX Connector prüfen und Connector online melden.",
        "Brain-/Objekt-KI blockiert bei RTX offline — Allgemeiner Cloud-Chat bleibt möglich.",
      ];
    }
    return [
      "Prüfe, ob Ollama/LM Studio auf dem RTX-Rechner läuft (AI_INFERENCE_BASE_URL).",
      "Optional: RTX Host Connector unter System → RTX Connector einrichten.",
      "Brain-/Objekt-KI blockiert bei RTX offline — Allgemeiner Cloud-Chat bleibt möglich.",
    ];
  }
  return [];
}
