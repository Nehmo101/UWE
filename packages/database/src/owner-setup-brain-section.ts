import type { SettingsService } from "./settings-service";
import type {
  SetupSectionLevel,
  SetupSectionStatus,
  SetupSettingItem,
} from "./owner-setup-service";

/**
 * Owner-setup section for the owner-only Brain product. Kept in its own module so
 * the frozen `owner-setup-service.ts` monolith does not grow (file-size budget).
 * Brain is owner-only; how it is reached is a deployment choice — this section
 * only surfaces its exposure and entry, editing happens under System → Cloudflare.
 */
export function buildBrainSection(
  settings: Awaited<ReturnType<SettingsService["getSettings"]>>,
): SetupSectionStatus {
  const d = settings.deployment;
  const editorHref = "/system/cloudflare";
  const exposureLabel =
    d.brainExposure === "lan"
      ? "LAN (nach Owner-Freigabe)"
      : d.brainExposure === "public"
        ? "Öffentlich (owner-gated Tunnel)"
        : d.brainExposure === "off"
          ? "Deaktiviert"
          : "Nur lokal (Loopback)";

  const settingsItems: SetupSettingItem[] = [
    {
      id: "brain-exposure",
      label: "Erreichbarkeit",
      configured: true,
      displayValue: exposureLabel,
      source: d.brainExposure === "loopback" ? "env" : "db",
      editable: true,
      description: "Owner-only auf jeder Route; die Erreichbarkeit ist eine bewusste Betriebsentscheidung (ADR 004/007).",
      href: editorHref,
    },
    {
      id: "brain-url",
      label: "Brain-URL",
      configured: true,
      displayValue: d.brainUrl.trim() || "teilt Studio-Origin",
      source: d.brainUrl.trim() ? "db" : "env",
      editable: true,
      href: editorHref,
    },
    {
      id: "brain-path",
      label: "Brain-Einstieg",
      configured: true,
      displayValue: d.brainPath.trim() || "/life-brain",
      source: d.brainPath.trim() ? "db" : "env",
      editable: true,
      href: editorHref,
    },
    {
      id: "brain-tunnel",
      label: "Im öffentlichen Tunnel",
      configured: true,
      displayValue:
        d.brainExposure === "public" ? "ja (owner-gated Opt-in)" : "nein (Standard)",
      source: "env",
      editable: false,
      description:
        "Brain kommt nur durch das ausdrückliche Opt-in BRAIN_PUBLIC_TUNNEL=1 in den Tunnel — nie als Nebeneffekt.",
    },
  ];

  const nextSteps: string[] = [];
  if (d.brainExposure === "off") {
    nextSteps.push("Brain-Einstieg ist deaktiviert — in System → Cloudflare auf „Nur lokal“ oder „LAN“ stellen.");
  } else if (d.brainExposure === "lan") {
    nextSteps.push("Brain ist im LAN erreichbar — nur nach bewusster Owner-Freigabe.");
  } else if (d.brainExposure === "public") {
    nextSteps.push("Brain ist öffentlich erreichbar (owner-gated Tunnel) — 2FA auf dem Owner-Konto aktivieren.");
  } else {
    nextSteps.push("Brain bleibt lokal (Loopback) — der sichere Standard.");
  }
  nextSteps.push("Privater Alltags- und Wissensbereich öffnen: /life-brain. Einstellungen: System → Cloudflare.");

  const level: SetupSectionLevel = d.brainExposure === "off" ? "disabled" : "ok";

  return {
    id: "brain",
    title: "Brain (privat)",
    level,
    statusLabel:
      level === "disabled" ? "Inaktiv" : d.brainExposure === "lan" ? "LAN" : "Lokal",
    message: "Owner-only Alltags- und Wissensbereich — lokal auf deiner Hardware, nie in der Cloud.",
    nextSteps,
    settings: settingsItems,
  };
}
