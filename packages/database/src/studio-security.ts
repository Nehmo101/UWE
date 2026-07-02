import {
  getUweRuntimeConfig,
  isPublicExposureConfigured,
} from "@uwe/auth";
import type { SystemStatus } from "./system-status";
import { isWeakAuthSecret } from "./production-safety";

/**
 * Studio security assessment for the Admin Status Dashboard.
 *
 * Studio access is gated by the UWE session login (e-mail sign-in) enforced
 * when AUTH_REQUIRED=true. A reverse proxy / Cloudflare Tunnel (with an optional
 * "Verify you are human" Managed Challenge or Turnstile widget) can sit in front,
 * but no separate Cloudflare Access sign-in is required.
 *
 * Reverse-proxy protection cannot be verified server-side; TRUST_PROXY and
 * CLOUDFLARE_TUNNEL are used as conservative heuristics.
 */

export type StudioSecurityLevel = "local_only" | "protected" | "unsafe" | "misconfigured";

export type StudioSecuritySeverity = "ok" | "warning" | "critical";

export type EndpointUrlKind = "loopback" | "private" | "link_local" | "public" | "invalid";

export interface StudioSecurityAssessment {
  level: StudioSecurityLevel;
  label: string;
  severity: StudioSecuritySeverity;
  message: string;
  publicExposureConfigured: boolean;
  proxyIndicators: {
    trustProxy: boolean;
    cloudflareTunnel: boolean;
    /** Heuristic — true when proxy/tunnel flags suggest network-level protection. */
    networkProtectionLikely: boolean;
  };
  checks: {
    studioApiTokenConfigured: boolean;
    authSecretConfigured: boolean;
    authSecretLooksWeak: boolean;
    runDbSeedDisabled: boolean;
    sessionCookieSecure: boolean;
    portalAuthRequired: boolean;
  };
  misconfigurations: string[];
  nextSteps: string[];
}

export interface EndpointExposureCheck {
  envKey: string;
  configured: boolean;
  endpointLabel: string | null;
  urlKind: EndpointUrlKind;
  /** False when URL looks public and AI_INFERENCE_ALLOW_PUBLIC_URL is not set. */
  privateNetworkOk: boolean;
  allowPublicUrlOverride: boolean;
}

export interface RtxExposureAssessment {
  ok: boolean;
  severity: StudioSecuritySeverity;
  message: string;
  endpoints: EndpointExposureCheck[];
  nextSteps: string[];
}

function sanitizeEndpointLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${parsed.hostname}${port}`;
  } catch {
    return "(ungültige URL)";
  }
}

export function classifyEndpointUrl(url: string): EndpointUrlKind {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return "loopback";
    }
    if (
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return "private";
    }
    if (hostname.startsWith("169.254.") || hostname.startsWith("fe80:")) {
      return "link_local";
    }
    return "public";
  } catch {
    return "invalid";
  }
}

function isPrivateEndpointUrl(url: string, allowPublicUrl: boolean): boolean {
  if (allowPublicUrl) {
    return true;
  }
  const kind = classifyEndpointUrl(url);
  return kind === "loopback" || kind === "private" || kind === "link_local";
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === "") {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return defaultValue;
}

const LEVEL_LABELS: Record<StudioSecurityLevel, string> = {
  local_only: "Nur lokal",
  protected: "Studio geschützt",
  unsafe: "Studio unsicher",
  misconfigured: "Falsch konfiguriert",
};

export function assessStudioSecurity(
  system: SystemStatus,
  env: NodeJS.ProcessEnv = process.env,
): StudioSecurityAssessment {
  const runtime = getUweRuntimeConfig(env);
  const publicExposure = isPublicExposureConfigured(env);
  const studioApiTokenConfigured = Boolean(env.STUDIO_API_TOKEN?.trim());
  const authSecret = env.AUTH_SECRET;
  const authSecretConfigured = Boolean(authSecret?.trim());
  const authSecretLooksWeak = isWeakAuthSecret(authSecret);
  const runDbSeedDisabled = (env.RUN_DB_SEED ?? "auto") === "false";
  const networkProtectionLikely = runtime.trustProxy || runtime.cloudflareTunnel;

  const misconfigurations: string[] = [];
  const nextSteps: string[] = [];

  if (publicExposure && runtime.isProduction && !runtime.trustProxy) {
    misconfigurations.push(
      "PUBLIC_APP_URL oder CLOUDFLARE_TUNNEL aktiv, aber TRUST_PROXY=false — Proxy-Header werden ignoriert.",
    );
  }

  if (publicExposure && runtime.publicAppUrl?.startsWith("https://") && !runtime.sessionCookieSecure) {
    misconfigurations.push(
      "Öffentliche HTTPS-URL, aber SESSION_COOKIE_SECURE=false — Session-Cookies sind unsicher.",
    );
  }

  if (publicExposure && authSecretLooksWeak) {
    misconfigurations.push("Öffentliche Erreichbarkeit mit schwachem oder fehlendem AUTH_SECRET.");
  }

  if (publicExposure && !runDbSeedDisabled) {
    misconfigurations.push("Öffentliche Erreichbarkeit, aber RUN_DB_SEED ist nicht false.");
  }

  if (runtime.isProduction && runtime.playerPreviewAllowDmOnly) {
    misconfigurations.push("PLAYER_PREVIEW_ALLOW_DM_ONLY ist in Production aktiv.");
  }

  let level: StudioSecurityLevel;
  let severity: StudioSecuritySeverity;
  let message: string;

  if (!publicExposure) {
    level = "local_only";
    severity = "ok";
    message =
      "Keine öffentliche URL konfiguriert — Studio ist nur lokal erreichbar. Für öffentliche Exposition AUTH_REQUIRED=true setzen — der UWE-Login (E-Mail) schützt den Zugang.";
    nextSteps.push(
      "Bei Cloudflare-Tunnel oder Reverse Proxy: PUBLIC_APP_URL, TRUST_PROXY=true und STUDIO_API_TOKEN setzen.",
    );
  } else if (misconfigurations.length > 0) {
    level = "misconfigured";
    severity = "critical";
    message =
      "Öffentliche Erreichbarkeit erkannt, aber die Konfiguration widerspricht sich oder ist unsicher.";
    nextSteps.push("Behebe die aufgelisteten Konfigurationsprobleme in .env.");
    nextSteps.push(
      "Studio darf nicht ungeschützt öffentlich sein — AUTH_REQUIRED=true (UWE-Login) erzwingen, optional Reverse-Proxy/VPN davor.",
    );
  } else if (!networkProtectionLikely) {
    level = "unsafe";
    severity = "critical";
    message =
      "Studio ist öffentlich erreichbar, aber TRUST_PROXY/CLOUDFLARE_TUNNEL fehlen — Proxy-Schutz ist serverseitig nicht erkennbar. AUTH_REQUIRED=true (UWE-Login) aktivieren und Proxy-Header korrekt setzen.";
    nextSteps.push("Setze TRUST_PROXY=true und CLOUDFLARE_TUNNEL=true, wenn Cloudflare genutzt wird.");
    if (!studioApiTokenConfigured) {
      nextSteps.push("Setze STUDIO_API_TOKEN für sensible Studio-APIs.");
    }
  } else if (!studioApiTokenConfigured) {
    level = "unsafe";
    severity = "critical";
    message =
      "Proxy/Tunnel erkannt, aber STUDIO_API_TOKEN fehlt — sensible APIs (Backup, AI, Settings) sind ohne Bearer-Token nicht abgesichert.";
    nextSteps.push("Setze STUDIO_API_TOKEN in .env und nutze es für Skripte/API-Clients.");
  } else if (!runtime.authRequired) {
    level = "protected";
    severity = "warning";
    message =
      "Studio-APIs sind abgesichert (Token + Proxy-Indikatoren). Der UWE-Login ist optional (AUTH_REQUIRED=false) — für öffentliches Studio/Portal aktivieren.";
    nextSteps.push("Setze AUTH_REQUIRED=true, damit der UWE-Login (E-Mail) den Zugang schützt.");
  } else {
    level = "protected";
    severity = "ok";
    message =
      "Proxy/Tunnel, STUDIO_API_TOKEN und UWE-Login (AUTH_REQUIRED) sind konfiguriert — der Zugang wird über den UWE-Login (E-Mail) geschützt.";
  }

  if (level === "misconfigured") {
    for (const item of misconfigurations) {
      nextSteps.push(item);
    }
  }

  return {
    level,
    label: LEVEL_LABELS[level],
    severity,
    message,
    publicExposureConfigured: publicExposure,
    proxyIndicators: {
      trustProxy: runtime.trustProxy,
      cloudflareTunnel: runtime.cloudflareTunnel,
      networkProtectionLikely,
    },
    checks: {
      studioApiTokenConfigured,
      authSecretConfigured,
      authSecretLooksWeak,
      runDbSeedDisabled,
      sessionCookieSecure: runtime.sessionCookieSecure,
      portalAuthRequired: runtime.authRequired,
    },
    misconfigurations,
    nextSteps: [...new Set(nextSteps)],
  };
}

function resolveInferenceBaseUrl(env: NodeJS.ProcessEnv): string | null {
  const unified = env.AI_INFERENCE_BASE_URL?.trim();
  if (unified) {
    return unified;
  }

  const ollama = env.OLLAMA_BASE_URL?.trim();
  if (ollama) {
    return ollama;
  }

  const openAiCompat = env.OPENAI_COMPATIBLE_BASE_URL?.trim();
  if (openAiCompat) {
    return openAiCompat;
  }

  return null;
}

function resolveEmbeddingBaseUrl(env: NodeJS.ProcessEnv): string | null {
  return (
    env.BRAIN_EMBEDDING_BASE_URL?.trim() ||
    env.AI_INFERENCE_BASE_URL?.trim() ||
    env.OLLAMA_BASE_URL?.trim() ||
    null
  );
}

function buildEndpointCheck(
  envKey: string,
  url: string | null,
  allowPublicUrl: boolean,
): EndpointExposureCheck {
  if (!url) {
    return {
      envKey,
      configured: false,
      endpointLabel: null,
      urlKind: "invalid",
      privateNetworkOk: true,
      allowPublicUrlOverride: allowPublicUrl,
    };
  }

  const urlKind = classifyEndpointUrl(url);
  const privateNetworkOk = isPrivateEndpointUrl(url, allowPublicUrl);

  return {
    envKey,
    configured: true,
    endpointLabel: sanitizeEndpointLabel(url),
    urlKind,
    privateNetworkOk,
    allowPublicUrlOverride: allowPublicUrl,
  };
}

export function assessRtxExposure(env: NodeJS.ProcessEnv = process.env): RtxExposureAssessment {
  const allowPublicUrl = parseBooleanEnv(env.AI_INFERENCE_ALLOW_PUBLIC_URL, false);
  const nextSteps: string[] = [];

  const endpoints: EndpointExposureCheck[] = [
    buildEndpointCheck("RTX_AGENT_URL", env.RTX_AGENT_URL?.trim() ?? null, allowPublicUrl),
    buildEndpointCheck("AI_INFERENCE_BASE_URL", resolveInferenceBaseUrl(env), allowPublicUrl),
    buildEndpointCheck("BRAIN_EMBEDDING_BASE_URL", resolveEmbeddingBaseUrl(env), allowPublicUrl),
  ];

  const publicLookingEndpoints = endpoints.filter(
    (endpoint) => endpoint.configured && endpoint.urlKind === "public",
  );

  if (publicLookingEndpoints.length === 0) {
    const configured = endpoints.filter((endpoint) => endpoint.configured);
    return {
      ok: true,
      severity: "ok",
      message:
        configured.length === 0
          ? "Keine RTX-/Inference-URLs konfiguriert — lokale KI nutzt Defaults (localhost)."
          : "RTX- und Inference-Endpoints zeigen auf private/loopback-Adressen.",
      endpoints,
      nextSteps:
        allowPublicUrl && configured.some((endpoint) => endpoint.urlKind === "public")
          ? [
              "AI_INFERENCE_ALLOW_PUBLIC_URL=true ist aktiv — nur bewusst für Tests nutzen, nicht in Production.",
            ]
          : [],
    };
  }

  if (allowPublicUrl) {
    nextSteps.push(
      "AI_INFERENCE_ALLOW_PUBLIC_URL=true überschreibt den Schutz — in Production deaktivieren.",
    );
    return {
      ok: false,
      severity: "warning",
      message: `${publicLookingEndpoints.length} Endpoint(s) sind öffentlich, aber durch AI_INFERENCE_ALLOW_PUBLIC_URL erlaubt — nur für Tests.`,
      endpoints,
      nextSteps: [...new Set(nextSteps)],
    };
  }

  for (const endpoint of publicLookingEndpoints) {
    nextSteps.push(
      `${endpoint.envKey} (${endpoint.endpointLabel}) wirkt öffentlich erreichbar — RTX/Ollama nur im Heimnetz betreiben.`,
    );
  }

  nextSteps.push(
    "Setze private Heimnetz-IP (z. B. http://192.168.x.x:11434) oder nutze den UWE RTX-Agent im LAN.",
  );
  nextSteps.push("RTX-Agent und Ollama/LM Studio niemals über Cloudflare oder öffentliche URLs exponieren.");

  return {
    ok: false,
    severity: "critical",
    message: `${publicLookingEndpoints.length} Endpoint(s) wirken öffentlich — RTX-Inference darf nicht ins Internet.`,
    endpoints,
    nextSteps: [...new Set(nextSteps)],
  };
}
