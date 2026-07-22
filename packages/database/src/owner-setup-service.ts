import { validateUweEnvironment } from "@uwe/auth";
import type { PrismaClient } from "./client";
import { buildBrainSection } from "./owner-setup-brain-section";
import { getAdminStatus, type AdminStatus } from "./admin-status";
import { createConnectorService } from "./connector-service";
import { scanPublicContentLeaks, type PublicLeakScanResult } from "./public-leak-scanner";
import { SettingsService, getPersistentPathConfiguration } from "./settings-service";
import { getSystemStatus, type SystemStatus } from "./system-status";
import { UWE_VERSION } from "./version";

export type OwnerSetupSectionId =
  | "system"
  | "access"
  | "cloudflare"
  | "brain"
  | "mail"
  | "rtx"
  | "printer"
  | "diagnose";

export type SetupSettingSource = "db" | "env" | "host-secret";

export type SetupSectionLevel = "ok" | "degraded" | "error" | "disabled";

export interface SetupSettingItem {
  id: string;
  label: string;
  description?: string;
  configured: boolean;
  displayValue: string;
  source: SetupSettingSource;
  editable: boolean;
  hostSecretRequired?: boolean;
  href?: string;
}

export interface SetupSectionStatus {
  id: OwnerSetupSectionId;
  title: string;
  level: SetupSectionLevel;
  statusLabel: string;
  message: string;
  nextSteps: string[];
  settings: SetupSettingItem[];
  testAction?: "mail" | "urls" | "rtx" | "printer";
}

export interface OwnerSetupSnapshot {
  ok: boolean;
  canEdit: boolean;
  role: string;
  timestamp: string;
  sections: SetupSectionStatus[];
}

export interface OwnerSetupOptions {
  env?: NodeJS.ProcessEnv;
  role?: string;
  canEdit?: boolean;
}

function boolLabel(value: boolean, yes = "ja", no = "nein"): string {
  return value ? yes : no;
}

function secretLabel(configured: boolean): string {
  return configured ? "gesetzt (Wert verborgen)" : "fehlt";
}

function sourceLabel(source: SetupSettingSource): string {
  if (source === "db") return "Datenbank";
  if (source === "env") return "Umgebung";
  return "Host-Secret";
}

function buildSystemSection(
  system: SystemStatus,
  settings: Awaited<ReturnType<SettingsService["getSettings"]>>,
): SetupSectionStatus {
  const paths = getPersistentPathConfiguration(settings);
  const storageOk = system.storage.ok;
  const backupOk = system.storage.backupsWritable;

  const settingsItems: SetupSettingItem[] = [
    {
      id: "database",
      label: "Datenbank",
      configured: system.database.ok,
      displayValue: system.database.ok ? "verbunden" : system.database.message,
      source: "env",
      editable: false,
    },
    {
      id: "uploads-path",
      label: "Uploads-Pfad",
      configured: system.storage.uploadsWritable,
      displayValue: system.storage.paths.uploadsDir,
      source: paths.uploads.source === "settings" ? "db" : "env",
      editable: true,
      href: "/admin/setup?tab=system#paths",
    },
    {
      id: "backups-path",
      label: "Backup-Pfad",
      configured: system.storage.backupsWritable,
      displayValue: system.storage.paths.backupsDir,
      source: paths.backups.source === "settings" ? "db" : "env",
      editable: true,
      href: "/admin/setup?tab=system#paths",
    },
    {
      id: "auto-backup",
      label: "Automatisches Backup",
      configured: settings.backup.autoBackupEnabled,
      displayValue: boolLabel(settings.backup.autoBackupEnabled, "aktiv", "inaktiv"),
      source: "db",
      editable: true,
      href: "/admin/setup?tab=system#backup",
    },
  ];

  const nextSteps: string[] = [];
  if (!storageOk) {
    nextSteps.push("Speicherpfade prüfen — Uploads oder Exports sind nicht beschreibbar.");
  }
  if (!backupOk) {
    nextSteps.push("Backup-Verzeichnis konfigurieren und Schreibrechte prüfen.");
  }
  if (!settings.backup.autoBackupEnabled) {
    nextSteps.push("Optional: Automatisches Backup aktivieren (System-Tab).");
  }
  if (nextSteps.length === 0) {
    nextSteps.push("System-Basis ist eingerichtet. Backup-Zeitplan unter /backup verwalten.");
  }

  const level: SetupSectionLevel =
    !system.database.ok || !storageOk ? "error" : !backupOk ? "degraded" : "ok";

  return {
    id: "system",
    title: "System",
    level,
    statusLabel: level === "ok" ? "Bereit" : level === "degraded" ? "Hinweise" : "Fehler",
    message: `UWE ${UWE_VERSION} · ${system.app.nodeEnv}${system.commit ? ` · ${system.commit.slice(0, 7)}` : ""}`,
    nextSteps,
    settings: settingsItems,
  };
}

function buildAccessSection(
  system: SystemStatus,
  settings: Awaited<ReturnType<SettingsService["getSettings"]>>,
  userCount: number,
): SetupSectionStatus {
  const settingsItems: SetupSettingItem[] = [
    {
      id: "portal-enabled",
      label: "Portal aktiv",
      configured: settings.portal.portalEnabled,
      displayValue: boolLabel(settings.portal.portalEnabled),
      source: "db",
      editable: true,
      href: "/admin/setup?tab=access#portal",
    },
    {
      id: "guest-access",
      label: "Gastzugang Portal",
      configured: settings.portal.guestAccessEnabled,
      displayValue: boolLabel(settings.portal.guestAccessEnabled),
      source: "db",
      editable: true,
      href: "/admin/setup?tab=access#portal",
    },
    {
      id: "public-sharing",
      label: "Öffentliche Freigabe",
      configured: settings.portal.publicSharingEnabled,
      displayValue: boolLabel(settings.portal.publicSharingEnabled),
      source: "db",
      editable: true,
      href: "/admin/setup?tab=access#portal",
    },
    {
      id: "auth-required",
      label: "Login erforderlich",
      configured: system.proxy.authRequired,
      displayValue: boolLabel(system.proxy.authRequired),
      source: deploymentOverrideSource(settings.deployment.authRequired),
      editable: true,
      description:
        "AUTH_REQUIRED — hier setzbar. Das Login-Gate der Edge-Middleware liest weiterhin die .env (Neustart nötig).",
      href: "/system/cloudflare",
    },
    {
      id: "session-timeout",
      label: "Session-Timeout (Min.)",
      configured: settings.auth.sessionInactivityTimeoutMinutes > 0,
      displayValue:
        settings.auth.sessionInactivityTimeoutMinutes > 0
          ? String(settings.auth.sessionInactivityTimeoutMinutes)
          : "deaktiviert",
      source: "db",
      editable: true,
      href: "/admin/setup?tab=access#session",
    },
    {
      id: "users",
      label: "Benutzer",
      configured: userCount > 0,
      displayValue: `${userCount} Konten`,
      source: "db",
      editable: true,
      href: "/admin/users",
    },
    {
      id: "auth-secret",
      label: "AUTH_SECRET",
      configured: system.trust.authSecretConfigured && !system.trust.authSecretLooksWeak,
      displayValue: secretLabel(system.trust.authSecretConfigured),
      source: "host-secret",
      editable: false,
      hostSecretRequired: !system.trust.authSecretConfigured,
    },
  ];

  const nextSteps: string[] = [];
  if (!system.trust.authSecretConfigured || system.trust.authSecretLooksWeak) {
    nextSteps.push("Starkes AUTH_SECRET auf dem Host setzen (Host-Secret erforderlich).");
  }
  if (!settings.portal.portalEnabled) {
    nextSteps.push("Portal aktivieren, wenn Spieler Wiki-Zugang brauchen.");
  }
  nextSteps.push("Benutzer und Rollen unter Zugriff → Benutzer verwalten.");
  if (system.trust.publicPortalSharingEnabled) {
    nextSteps.push("Öffentliche Portal-Freigabe ist aktiv — Sichtbarkeit regelmäßig prüfen.");
  }

  const level: SetupSectionLevel =
    !system.trust.authSecretConfigured || system.trust.authSecretLooksWeak
      ? "error"
      : !settings.portal.portalEnabled
        ? "degraded"
        : "ok";

  return {
    id: "access",
    title: "Zugriff",
    level,
    statusLabel: level === "ok" ? "Konfiguriert" : level === "degraded" ? "Optional offen" : "Kritisch",
    message: "Portal-Zugang, Benutzer und Session-Richtlinien.",
    nextSteps,
    settings: settingsItems,
  };
}

function deploymentStringSource(value: string): SetupSettingSource {
  return value.trim() ? "db" : "env";
}

function deploymentOverrideSource(value: "env" | "on" | "off"): SetupSettingSource {
  return value === "env" ? "env" : "db";
}

function buildCloudflareSection(
  system: SystemStatus,
  settings: Awaited<ReturnType<SettingsService["getSettings"]>>,
): SetupSectionStatus {
  const proxy = system.proxy;
  const d = settings.deployment;
  const editorHref = "/system/cloudflare";
  const settingsItems: SetupSettingItem[] = [
    {
      id: "public-url",
      label: "Öffentliche Basis-URL",
      configured: Boolean(proxy.publicAppUrl),
      displayValue: proxy.publicAppUrl ?? "nicht gesetzt",
      source: deploymentStringSource(d.publicAppUrl),
      editable: true,
      description: "PUBLIC_APP_URL / PUBLIC_BASE_URL",
      href: editorHref,
    },
    {
      id: "studio-url",
      label: "Studio-URL",
      configured: Boolean(proxy.studioUrl),
      displayValue: proxy.studioUrl ?? "nicht gesetzt",
      source: deploymentStringSource(d.studioUrl),
      editable: true,
      href: editorHref,
    },
    {
      id: "portal-url",
      label: "Portal-URL",
      configured: Boolean(proxy.portalUrl),
      displayValue: proxy.portalUrl ?? "nicht gesetzt",
      source: deploymentStringSource(d.portalUrl),
      editable: true,
      href: editorHref,
    },
    {
      id: "trust-proxy",
      label: "TRUST_PROXY",
      configured: proxy.trustProxy,
      displayValue: boolLabel(proxy.trustProxy),
      source: deploymentOverrideSource(d.trustProxy),
      editable: true,
      href: editorHref,
    },
    {
      id: "cf-tunnel",
      label: "Cloudflare Tunnel",
      configured: proxy.cloudflareTunnel,
      displayValue: boolLabel(proxy.cloudflareTunnel),
      source: deploymentOverrideSource(d.cloudflareTunnel),
      editable: true,
      href: editorHref,
    },
    {
      id: "human-check",
      label: "„Mensch“-Prüfung (Turnstile)",
      configured: proxy.cloudflare.humanVerificationEnabled,
      displayValue: boolLabel(proxy.cloudflare.humanVerificationEnabled, "aktiv", "inaktiv"),
      source:
        d.turnstileEnabled !== "env" || d.turnstileSecretConfigured || d.turnstileSiteKey.trim()
          ? "db"
          : "env",
      editable: true,
      href: editorHref,
    },
    {
      id: "studio-api-token",
      label: "STUDIO_API_TOKEN",
      configured: system.trust.studioApiTokenConfigured,
      displayValue: secretLabel(system.trust.studioApiTokenConfigured),
      source: "host-secret",
      editable: false,
      hostSecretRequired:
        proxy.publicExposureConfigured && !system.trust.studioApiTokenConfigured,
    },
  ];

  const nextSteps: string[] = [];
  if (proxy.publicExposureConfigured && !proxy.trustProxy) {
    nextSteps.push("Trust-Proxy aktivieren (System → Cloudflare), wenn hinter Cloudflare/Reverse-Proxy.");
  }
  if (proxy.publicExposureConfigured && !system.trust.studioApiTokenConfigured) {
    nextSteps.push("STUDIO_API_TOKEN setzen — öffentliches Studio ohne Token ist blockiert.");
  }
  if (!proxy.publicAppUrl) {
    nextSteps.push("Für Remote-Zugriff die öffentliche Basis-URL setzen (System → Cloudflare).");
  } else if (!proxy.cloudflareTunnel) {
    nextSteps.push("Cloudflare Tunnel optional — nur Studio/Portal exponieren, nie RTX.");
  }
  nextSteps.push("Routing, Proxy, Turnstile und Sicherheits-Flags bearbeiten: System → Cloudflare.");

  const level: SetupSectionLevel =
    proxy.publicExposureConfigured &&
    (!system.trust.studioApiTokenConfigured || !proxy.trustProxy)
      ? "error"
      : !proxy.publicAppUrl
        ? "degraded"
        : "ok";

  return {
    id: "cloudflare",
    title: "Cloudflare & Domains",
    level,
    statusLabel: level === "ok" ? "OK" : level === "degraded" ? "Lokal" : "Handlung nötig",
    message: system.trust.exposureHint,
    nextSteps,
    settings: settingsItems,
    testAction: "urls",
  };
}

function buildMailSection(
  system: SystemStatus,
  settings: Awaited<ReturnType<SettingsService["getSettings"]>>,
): SetupSectionStatus {
  const smtp = settings.mail.smtp;
  const settingsItems: SetupSettingItem[] = [
    {
      id: "mail-enabled",
      label: "Mail Center aktiv",
      configured: settings.mail.enabled,
      displayValue: boolLabel(settings.mail.enabled),
      source: "db",
      editable: true,
      href: "/admin/setup?tab=mail#smtp",
    },
    {
      id: "smtp-host",
      label: "SMTP-Host",
      configured: smtp.configured,
      displayValue: smtp.host ?? "nicht gesetzt",
      source: smtp.source === "portal" ? "db" : "env",
      editable: true,
      href: "/admin/setup?tab=mail#smtp",
    },
    {
      id: "smtp-user",
      label: "SMTP-Benutzer",
      configured: smtp.userConfigured,
      displayValue: smtp.userConfigured ? (smtp.username ?? "gesetzt") : "fehlt",
      source: smtp.source === "portal" ? "db" : "env",
      editable: true,
      href: "/admin/setup?tab=mail#smtp",
    },
    {
      id: "smtp-password",
      label: "SMTP-Passwort",
      configured: smtp.passwordConfigured,
      displayValue: secretLabel(smtp.passwordConfigured),
      source: smtp.source === "portal" ? "db" : "host-secret",
      editable: true,
      hostSecretRequired: !smtp.passwordConfigured && smtp.source === "env",
      href: "/admin/setup?tab=mail#smtp",
    },
    {
      id: "mail-from",
      label: "Absender",
      configured: Boolean(smtp.fromAddress),
      displayValue: smtp.fromAddress ?? "fehlt",
      source: smtp.source === "portal" ? "db" : "env",
      editable: true,
      href: "/admin/setup?tab=mail#smtp",
    },
    {
      id: "imap-portal",
      label: "IMAP / Mail Portal",
      configured: true,
      displayValue: "Konten im Mail Portal",
      source: "db",
      editable: true,
      href: "/admin/mail",
    },
  ];

  const nextSteps: string[] = [];
  if (!settings.mail.enabled) {
    nextSteps.push("Mail Center aktivieren (Mail-Tab).");
  }
  if (!smtp.configured) {
    nextSteps.push("SMTP im Mail-Tab konfigurieren — keine manuelle Host-Datei nötig.");
  } else {
    nextSteps.push("Testmail senden, um SMTP-Verbindung zu prüfen.");
  }
  nextSteps.push("IMAP-Konten für Posteingang unter /admin/mail anlegen.");

  const level: SetupSectionLevel =
    settings.mail.enabled && !smtp.configured
      ? "error"
      : !settings.mail.enabled
        ? "disabled"
        : "ok";

  return {
    id: "mail",
    title: "Mail",
    level,
    statusLabel:
      level === "ok" ? "Bereit" : level === "disabled" ? "Inaktiv" : "Unvollständig",
    message: system.mail.message,
    nextSteps,
    settings: settingsItems,
    testAction: "mail",
  };
}

function resolveInferenceEnvSummary(env: NodeJS.ProcessEnv): {
  enabled: boolean;
  configured: boolean;
  endpointLabel: string;
} {
  const useMock = env.AI_USE_MOCK?.trim().toLowerCase() === "true";
  const enabled =
    env.AI_BRAIN_ENABLED?.trim().toLowerCase() !== "false" &&
    env.AI_INFERENCE_DISABLED?.trim().toLowerCase() !== "true";
  const baseUrl =
    env.AI_INFERENCE_BASE_URL?.trim() ||
    env.OLLAMA_BASE_URL?.trim() ||
    env.OPENAI_COMPATIBLE_BASE_URL?.trim() ||
    "";
  return {
    enabled: enabled || useMock,
    configured: useMock || Boolean(baseUrl),
    endpointLabel: useMock ? "Mock-Modus" : baseUrl || "Standard (localhost)",
  };
}

async function buildRtxSection(
  db: PrismaClient,
  admin: AdminStatus,
  settings: Awaited<ReturnType<SettingsService["getSettings"]>>,
  env: NodeJS.ProcessEnv,
): Promise<SetupSectionStatus> {
  const connectors = await createConnectorService(db).listConnectors();
  const liveConnectors = connectors.filter(
    (connector) =>
      !connector.disabled &&
      (connector.status === "online" || connector.status === "degraded"),
  );
  const connectorLlmReady = liveConnectors.some((connector) =>
    connector.capabilities.includes("llm_local"),
  );
  const onlineConnectors = connectors.filter((c) => c.status === "online").length;
  const inference = resolveInferenceEnvSummary(env);

  const settingsItems: SetupSettingItem[] = [
    {
      id: "connectors",
      label: "RTX Host Connectors",
      configured: connectors.length > 0,
      displayValue: `${connectors.length} registriert · ${liveConnectors.length} live (${onlineConnectors} online)`,
      source: "db",
      editable: true,
      href: "/system/rtx-connector",
    },
    {
      id: "inference",
      label: "Inference-Endpunkt",
      configured: inference.configured,
      displayValue: inference.enabled ? inference.endpointLabel : "deaktiviert",
      source: "env",
      editable: false,
      description: "Erreichbarkeit per RTX-Test prüfen.",
    },
    {
      id: "image-studio",
      label: "Image Studio",
      configured: settings.imageStudio.enabled && settings.imageStudio.localImageBackendReady,
      displayValue: settings.imageStudio.message,
      source: settings.imageStudio.source === "portal" ? "db" : "env",
      editable: true,
      href: "/settings?tab=image-studio",
    },
    {
      id: "ai-gateway",
      label: "KI-Gateway (Fallback)",
      configured: true,
      displayValue: "Owner-Wizard",
      source: "db",
      editable: true,
      href: "/admin/ai-gateway",
    },
    {
      id: "hardware",
      label: "Homelab-Geräte",
      configured: true,
      displayValue: "Hardware-Cockpit",
      source: "db",
      editable: true,
      href: "/hardware",
    },
  ];

  const nextSteps: string[] = [];
  if (connectors.length === 0) {
    nextSteps.push("RTX Host Connector anlegen unter RTX & Hardware → Connector.");
  } else if (liveConnectors.length === 0) {
    nextSteps.push("Connector-Token im RTX-Client eintragen und Dienst starten.");
  } else if (!connectorLlmReady) {
    nextSteps.push("Connector läuft, aber lokale LLM-Fähigkeit fehlt — Ollama auf dem RTX-PC prüfen.");
  }
  if (inference.enabled) {
    nextSteps.push("Inference-Endpunkt per RTX-Test prüfen.");
  }
  if (!admin.rtxExposure.ok) {
    nextSteps.push(...admin.rtxExposure.nextSteps.slice(0, 2));
  }
  if (nextSteps.length === 0) {
    nextSteps.push("RTX bleibt im LAN — nie öffentlich exponieren.");
  }

  const level: SetupSectionLevel = !admin.rtxExposure.ok
    ? "error"
    : connectorLlmReady
      ? "ok"
      : connectors.length === 0 || !inference.configured
        ? "degraded"
        : "degraded";

  const statusMessage = connectorLlmReady
    ? "RTX Host Connector meldet lokale KI-Fähigkeit."
    : liveConnectors.length > 0
      ? "Connector verbunden, aber lokale Inference noch nicht bereit."
      : admin.rtxExposure.message;

  return {
    id: "rtx",
    title: "RTX & Hardware",
    level,
    statusLabel: level === "ok" ? "Verbunden" : level === "degraded" ? "Teilweise" : "Warnung",
    message: statusMessage,
    nextSteps,
    settings: settingsItems,
    testAction: "rtx",
  };
}

async function buildPrinterSection(db: PrismaClient): Promise<SetupSectionStatus> {
  const [labelCount, templateCount, worldCount] = await Promise.all([
    db.label.count(),
    db.labelTemplate.count(),
    db.world.count(),
  ]);

  const settingsItems: SetupSettingItem[] = [
    {
      id: "label-templates",
      label: "Label-Vorlagen",
      configured: templateCount > 0,
      displayValue: `${templateCount} Vorlagen (6×4 Zoll)`,
      source: "db",
      editable: true,
      href: "/worlds",
    },
    {
      id: "labels",
      label: "Gespeicherte Labels",
      configured: labelCount > 0,
      displayValue: `${labelCount} Labels`,
      source: "db",
      editable: true,
      href: "/worlds",
    },
    {
      id: "print-lists",
      label: "Drucklisten",
      configured: true,
      displayValue: "Pro Welt unter Labels → Drucklisten",
      source: "db",
      editable: true,
      href: "/worlds",
    },
    {
      id: "workshop-profiles",
      label: "3D-Druck Profile",
      configured: true,
      displayValue: "Werkstatt → Druckprofile",
      source: "db",
      editable: true,
      href: "/workshop/print-profiles",
    },
  ];

  const nextSteps: string[] = [];
  if (worldCount === 0) {
    nextSteps.push("Zuerst eine Welt anlegen, dann Labels unter Welt → Labels erstellen.");
  } else {
    nextSteps.push("Labels in einer Welt anlegen und Browser-Druck oder PDF-Export testen.");
  }
  nextSteps.push("Kein OS-Druckertreiber nötig — UWE nutzt Browser-Druck/PDF für 6×4 Handouts.");

  const level: SetupSectionLevel = templateCount > 0 ? "ok" : "degraded";

  return {
    id: "printer",
    title: "Drucker",
    level,
    statusLabel: level === "ok" ? "Bereit" : "Vorlagen fehlen",
    message: "Label- und Handout-Druck über UWE (6×4 Zoll) — kein separater Druckertreiber.",
    nextSteps,
    settings: settingsItems,
    testAction: "printer",
  };
}

function buildDiagnoseSection(
  admin: AdminStatus,
  publicLeaks: PublicLeakScanResult,
  envIssues: ReturnType<typeof validateUweEnvironment>,
): SetupSectionStatus {
  const leakOk = publicLeaks.criticalCount === 0;
  const envOk = envIssues.filter((issue) => issue.severity === "error").length === 0;

  const settingsItems: SetupSettingItem[] = [
    {
      id: "overall",
      label: "Gesamtstatus",
      configured: admin.ok,
      displayValue: admin.ok ? "OK" : "Einschränkungen",
      source: "env",
      editable: false,
    },
    {
      id: "leak-scanner",
      label: "Leak-Scanner",
      configured: leakOk,
      displayValue: leakOk
        ? "keine kritischen Leaks"
        : `${publicLeaks.criticalCount} kritisch · ${publicLeaks.findingCount} gesamt`,
      source: "env",
      editable: false,
      href: "/system?tab=diagnose",
    },
    {
      id: "env-validation",
      label: "ENV-Validierung",
      configured: envOk,
      displayValue: envOk ? "OK" : `${envIssues.length} Hinweise`,
      source: "env",
      editable: false,
      href: "/system?tab=diagnose",
    },
    {
      id: "private-health",
      label: "Private Health API",
      configured: true,
      displayValue: "STUDIO_API_TOKEN erforderlich",
      source: "host-secret",
      editable: false,
      description: "GET /api/health/private",
    },
  ];

  const nextSteps: string[] = [];
  if (!leakOk) {
    nextSteps.push("Leak-Scanner-Hinweise unter /system?tab=diagnose prüfen.");
  }
  if (!envOk) {
    nextSteps.push("ENV-Warnungen beheben — Details im Diagnose-Dashboard.");
  }
  nextSteps.push("Vollständiges Diagnose-Dashboard: /system?tab=diagnose");

  const level: SetupSectionLevel = admin.ok ? "ok" : leakOk ? "degraded" : "error";

  return {
    id: "diagnose",
    title: "Diagnose",
    level,
    statusLabel: level === "ok" ? "Gesund" : "Prüfen",
    message: "Health, Leak-Scanner und ENV-Validierung — ohne Secrets.",
    nextSteps,
    settings: settingsItems,
  };
}

export async function getOwnerSetupSnapshot(
  db: PrismaClient,
  options: OwnerSetupOptions = {},
): Promise<OwnerSetupSnapshot> {
  const env = options.env ?? process.env;
  const canEdit = options.canEdit ?? false;
  const role = options.role ?? "unknown";

  const [system, settings, admin, userCount, publicLeaks, envIssues] = await Promise.all([
    getSystemStatus(db, { env }),
    new SettingsService(db).getSettings(),
    getAdminStatus(db, { env }),
    db.user.count(),
    scanPublicContentLeaks(db),
    Promise.resolve(validateUweEnvironment(env)),
  ]);

  const sections = await Promise.all([
    Promise.resolve(buildSystemSection(system, settings)),
    Promise.resolve(buildAccessSection(system, settings, userCount)),
    Promise.resolve(buildCloudflareSection(system, settings)),
    Promise.resolve(buildBrainSection(settings)),
    Promise.resolve(buildMailSection(system, settings)),
    buildRtxSection(db, admin, settings, env),
    buildPrinterSection(db),
    Promise.resolve(buildDiagnoseSection(admin, publicLeaks, envIssues)),
  ]);

  const ok = sections.every((section) => section.level === "ok" || section.level === "disabled");

  return {
    ok,
    canEdit,
    role,
    timestamp: new Date().toISOString(),
    sections,
  };
}

export function assertOwnerSetupHasNoSecrets(
  snapshot: OwnerSetupSnapshot,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const serialized = JSON.stringify(snapshot);
  const secretKeys = [
    "SESSION_SECRET",
    "SMTP_PASSWORD",
    "AUTH_SECRET",
    "UWE_SETUP_TOKEN",
    "STUDIO_API_TOKEN",
    "AI_INFERENCE_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "RESTORE_OWNER_TOKEN",
    "UWE_CONNECTOR_TOKEN",
    "RTX_AGENT_TOKEN",
  ] as const;

  for (const key of secretKeys) {
    const value = env[key]?.trim();
    if (value && value.length >= 8 && serialized.includes(value)) {
      throw new Error(`Owner setup snapshot leaked env secret: ${key}`);
    }
  }

  if (/passwordEnc|keyEnc|tokenEnc/i.test(serialized)) {
    throw new Error("Owner setup snapshot contains encrypted secret field names with values");
  }
}

export function formatSetupSourceBadge(source: SetupSettingSource): string {
  return sourceLabel(source);
}
