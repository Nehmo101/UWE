import { classifyEndpointUrl } from "./studio-security";

export interface HardwareUrlWarning {
  deviceId: string;
  deviceName: string;
  field: "publicUrl" | "localUrl";
  url: string;
  message: string;
}

export function detectHardwareUrlWarnings(
  devices: Array<{
    id: string;
    name: string;
    publicUrl?: string | null;
    localUrl?: string | null;
    role?: string | null;
  }>,
): HardwareUrlWarning[] {
  const warnings: HardwareUrlWarning[] = [];

  for (const device of devices) {
    if (device.publicUrl?.trim()) {
      const kind = classifyEndpointUrl(device.publicUrl);
      if (kind === "public") {
        warnings.push({
          deviceId: device.id,
          deviceName: device.name,
          field: "publicUrl",
          url: device.publicUrl,
          message:
            "Öffentliche URL auf Hardware-Gerät — RTX/Ollama/UWE-Infrastruktur nicht öffentlich exponieren.",
        });
      }
    }

    const role = device.role?.toLowerCase() ?? "";
    const isRtxRole = role.includes("rtx") || role.includes("ollama") || role.includes("local-ai");

    if (device.publicUrl?.trim() && isRtxRole) {
      const kind = classifyEndpointUrl(device.publicUrl);
      if (kind !== "private" && kind !== "loopback") {
        warnings.push({
          deviceId: device.id,
          deviceName: device.name,
          field: "publicUrl",
          url: device.publicUrl,
          message: "RTX-Gerät mit nicht-lokaler URL — nur Heimnetz erlaubt.",
        });
      }
    }

    if (device.localUrl?.trim() && isRtxRole) {
      const kind = classifyEndpointUrl(device.localUrl);
      if (kind === "public") {
        warnings.push({
          deviceId: device.id,
          deviceName: device.name,
          field: "localUrl",
          url: device.localUrl,
          message: "RTX/Ollama localUrl ist öffentlich — niemals exposen.",
        });
      }
    }
  }

  return warnings;
}

export function countOpenSetupSteps(
  setupSteps: unknown,
): number {
  if (!Array.isArray(setupSteps)) {
    return 0;
  }

  return setupSteps.filter((step) => {
    if (typeof step === "string") {
      return step.trim().length > 0;
    }
    if (step && typeof step === "object" && "done" in step) {
      return !(step as { done?: boolean }).done;
    }
    return true;
  }).length;
}

export function extractHardwareRunbook(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || !("runbook" in metadata)) {
    return "";
  }
  const runbook = (metadata as { runbook?: unknown }).runbook;
  return typeof runbook === "string" ? runbook : "";
}

export function mergeHardwareRunbookMetadata(
  metadata: unknown,
  runbook: string,
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const trimmed = runbook.trim();
  if (trimmed) {
    base.runbook = trimmed;
  } else {
    delete base.runbook;
  }
  return base;
}
