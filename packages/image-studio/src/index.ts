/**
 * UWE Image Studio — image generation and editing via local RTX or optional cloud AI.
 */

export type ImageProviderMode = "auto" | "local_rtx" | "cloud" | "disabled";

export type ImageStudioTask =
  | "generate"
  | "edit"
  | "inpaint"
  | "remove_background"
  | "variant";

import {
  assembleImageStudioPrompt,
  scanPromptForPrivateDataLeak,
  type ImageStudioPromptContextMode,
} from "./prompt-privacy";

export type { ImageStudioPromptContextMode } from "./prompt-privacy";
export {
  assembleImageStudioPrompt,
  ImageStudioPrivacyError,
  isCloudImageProvider,
  isLocalOnlyImageContext,
  scanPromptForPrivateDataLeak,
  validateImageContextForProvider,
} from "./prompt-privacy";

export interface ImageStudioRequest {
  task: ImageStudioTask;
  prompt: string;
  providerMode?: ImageProviderMode;
  sourceImageBase64?: string;
  maskBase64?: string;
  width?: number;
  height?: number;
  contextMode?: ImageStudioPromptContextMode;
  contextSnippet?: string | null;
  cloudContextApproved?: boolean;
}

export interface ImageStudioResult {
  success: boolean;
  providerUsed: ImageProviderMode;
  imageBase64?: string;
  mimeType?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Optional host-supplied bridge that runs an `image_generate` job through the
 * outbound RTX Host Connector queue instead of calling the legacy inbound RTX
 * Agent HTTP endpoint. Injected by the host (which has DB/queue access) so this
 * package stays dependency-free.
 */
export type ConnectorImageGenerate = (
  request: ImageStudioRequest,
) => Promise<ImageStudioResult>;

export interface ImageStudioProviderConfig {
  enabled: boolean;
  allowCloud: boolean;
  rtxAgentUrl?: string;
  rtxAgentToken?: string;
  cloudApiKey?: string;
  cloudProvider?: string;
  cloudModel?: string;
  defaultMode: ImageProviderMode;
  /** When true, prefer the connector image_generate queue over direct RTX Agent HTTP. */
  useConnectorImage?: boolean;
  /** Host-injected connector queue bridge (see {@link ConnectorImageGenerate}). */
  connectorImageGenerate?: ConnectorImageGenerate;
}

export function resolveImageProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): ImageStudioProviderConfig {
  const rtxWorkerUrl = env.RTX_BASE_URL?.trim() || env.RTX_AGENT_URL?.trim();
  const rtxWorkerToken = env.RTX_SERVICE_TOKEN?.trim() || env.RTX_AGENT_TOKEN?.trim();
  return {
    enabled: env.IMAGE_STUDIO_ENABLED !== "false",
    allowCloud: env.IMAGE_STUDIO_ALLOW_CLOUD === "true",
    rtxAgentUrl: rtxWorkerUrl,
    rtxAgentToken: rtxWorkerToken,
    cloudApiKey: env.CLOUD_AI_API_KEY?.trim() || env.OPENAI_API_KEY?.trim(),
    cloudProvider: env.CLOUD_AI_PROVIDER?.trim() || "openai",
    cloudModel: env.IMAGE_STUDIO_CLOUD_MODEL?.trim() || env.CLOUD_AI_MODEL?.trim() || "dall-e-3",
    defaultMode:
      (env.IMAGE_STUDIO_DEFAULT_PROVIDER?.trim() as ImageProviderMode) || "auto",
    useConnectorImage: env.RTX_USE_CONNECTOR_IMAGE === "true",
  };
}

let warnedRtxAgentImageDeprecation = false;

function warnRtxAgentImageDeprecation(via: "connector" | "direct"): void {
  if (warnedRtxAgentImageDeprecation) return;
  warnedRtxAgentImageDeprecation = true;
  const tail =
    via === "connector"
      ? "Routing über die RTX-Host-Connector-Queue (image_generate)."
      : "Direkter Aufruf des Legacy-Endpunkts — bitte auf den outbound RTX Host Connector migrieren (RTX_USE_CONNECTOR_IMAGE=true).";
  console.warn(`[image-studio] RTX_AGENT_URL ist veraltet. ${tail}`);
}

/** A local image backend is available via the connector bridge or the legacy RTX Agent URL. */
function hasLocalImageBackend(config: ImageStudioProviderConfig): boolean {
  return Boolean(
    (config.useConnectorImage && config.connectorImageGenerate) || config.rtxAgentUrl,
  );
}

async function checkRtxAvailable(config: ImageStudioProviderConfig): Promise<boolean> {
  if (!config.rtxAgentUrl) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const headers: Record<string, string> = {};
    if (config.rtxAgentToken) headers.Authorization = `Bearer ${config.rtxAgentToken}`;
    const response = await fetch(`${config.rtxAgentUrl.replace(/\/$/, "")}/health`, {
      signal: controller.signal,
      headers,
    });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveProvider(
  mode: ImageProviderMode,
  config: ImageStudioProviderConfig,
): Promise<ImageProviderMode> {
  if (mode === "disabled" || !config.enabled) return "disabled";
  if (mode === "local_rtx") return hasLocalImageBackend(config) ? "local_rtx" : "disabled";
  if (mode === "cloud") return config.allowCloud && config.cloudApiKey ? "cloud" : "disabled";
  // auto: prefer the connector queue when configured, then legacy RTX Agent.
  if (config.useConnectorImage && config.connectorImageGenerate) return "local_rtx";
  const rtxUp = await checkRtxAvailable(config);
  if (rtxUp) return "local_rtx";
  if (config.allowCloud && config.cloudApiKey) return "cloud";
  return "disabled";
}

async function runLocalImageTask(
  config: ImageStudioProviderConfig,
  request: ImageStudioRequest,
): Promise<ImageStudioResult> {
  if (config.useConnectorImage && config.connectorImageGenerate) {
    if (config.rtxAgentUrl) warnRtxAgentImageDeprecation("connector");
    return config.connectorImageGenerate(request);
  }
  if (config.rtxAgentUrl) warnRtxAgentImageDeprecation("direct");
  return callRtxImageAgent(config, request);
}

async function callRtxImageAgent(
  config: ImageStudioProviderConfig,
  request: ImageStudioRequest,
): Promise<ImageStudioResult> {
  if (!config.rtxAgentUrl) {
    return { success: false, providerUsed: "local_rtx", error: "RTX Agent URL nicht konfiguriert." };
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.rtxAgentToken) headers.Authorization = `Bearer ${config.rtxAgentToken}`;

  const response = await fetch(`${config.rtxAgentUrl.replace(/\/$/, "")}/v1/images`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      task: request.task,
      prompt: request.prompt,
      source_image: request.sourceImageBase64,
      mask: request.maskBase64,
      width: request.width ?? 1024,
      height: request.height ?? 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      success: false,
      providerUsed: "local_rtx",
      error: `RTX Image Agent Fehler (${response.status}): ${text.slice(0, 200)}`,
    };
  }

  const data = (await response.json()) as { image?: string; mime_type?: string };
  if (!data.image) {
    return { success: false, providerUsed: "local_rtx", error: "Kein Bild vom RTX Agent erhalten." };
  }
  return {
    success: true,
    providerUsed: "local_rtx",
    imageBase64: data.image,
    mimeType: data.mime_type ?? "image/png",
  };
}

function extractCloudImage(data: { data?: Array<{ b64_json?: string }> }): string | null {
  return data.data?.[0]?.b64_json ?? null;
}

/**
 * Model for the OpenAI edits endpoint: dall-e-3 does not support edits, so
 * fall back to gpt-image-1 unless an edit-capable model is configured.
 */
export function resolveCloudEditModel(
  cloudModel: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.IMAGE_STUDIO_CLOUD_EDIT_MODEL?.trim();
  if (explicit) return explicit;
  if (cloudModel === "dall-e-2" || cloudModel === "gpt-image-1") return cloudModel;
  return "gpt-image-1";
}

async function callCloudImageEdit(
  config: ImageStudioProviderConfig,
  request: ImageStudioRequest,
): Promise<ImageStudioResult> {
  if (!request.sourceImageBase64) {
    return {
      success: false,
      providerUsed: "cloud",
      error: `'${request.task}' erfordert ein Ausgangsbild.`,
    };
  }

  const model = resolveCloudEditModel(config.cloudModel);
  const form = new FormData();
  form.set("model", model);
  form.set("n", "1");
  form.set(
    "prompt",
    request.task === "remove_background"
      ? `Entferne den Hintergrund vollständig, Motiv freistellen. ${request.prompt}`.trim()
      : request.prompt,
  );
  form.set(
    "image",
    new Blob([Buffer.from(request.sourceImageBase64, "base64")], { type: "image/png" }),
    "image.png",
  );
  if (request.maskBase64 && request.task === "inpaint") {
    form.set(
      "mask",
      new Blob([Buffer.from(request.maskBase64, "base64")], { type: "image/png" }),
      "mask.png",
    );
  }
  if (request.task === "remove_background" && model === "gpt-image-1") {
    form.set("background", "transparent");
  }
  // gpt-image-1 liefert immer b64 und lehnt response_format ab; dall-e-2 braucht es.
  if (model.startsWith("dall-e")) {
    form.set("response_format", "b64_json");
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.cloudApiKey}` },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      success: false,
      providerUsed: "cloud",
      error: `Cloud-Bildbearbeitung fehlgeschlagen (${response.status}): ${text.slice(0, 200)}`,
    };
  }

  const b64 = extractCloudImage(
    (await response.json()) as { data?: Array<{ b64_json?: string }> },
  );
  if (!b64) {
    return { success: false, providerUsed: "cloud", error: "Kein Bild von Cloud-API erhalten." };
  }
  return { success: true, providerUsed: "cloud", imageBase64: b64, mimeType: "image/png" };
}

async function callCloudImageApi(
  config: ImageStudioProviderConfig,
  request: ImageStudioRequest,
): Promise<ImageStudioResult> {
  if (!config.cloudApiKey) {
    return { success: false, providerUsed: "cloud", error: "Cloud-KI nicht konfiguriert." };
  }

  if (request.task === "generate" || request.task === "variant") {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.cloudApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.cloudModel,
        prompt: request.prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        success: false,
        providerUsed: "cloud",
        error: `Cloud-Bildgenerierung fehlgeschlagen (${response.status}): ${text.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = extractCloudImage(data);
    if (!b64) {
      return { success: false, providerUsed: "cloud", error: "Kein Bild von Cloud-API erhalten." };
    }
    return { success: true, providerUsed: "cloud", imageBase64: b64, mimeType: "image/png" };
  }

  // edit / inpaint / remove_background über die OpenAI-Edits-API.
  return callCloudImageEdit(config, request);
}

export async function runImageStudioTask(
  request: ImageStudioRequest,
  config?: ImageStudioProviderConfig,
): Promise<ImageStudioResult> {
  const resolvedConfig = config ?? resolveImageProviderConfig();
  const mode = await resolveProvider(request.providerMode ?? resolvedConfig.defaultMode, resolvedConfig);

  if (mode === "disabled") {
    return {
      success: false,
      providerUsed: "disabled",
      error:
        "Image Studio nicht verfügbar. RTX Agent offline und Cloud-KI deaktiviert oder nicht konfiguriert.",
    };
  }

  const assembled = assembleImageStudioPrompt({
    prompt: request.prompt,
    contextMode: request.contextMode,
    contextSnippet: request.contextSnippet,
    providerMode: request.providerMode ?? resolvedConfig.defaultMode,
    resolvedProvider: mode,
    cloudContextApproved: request.cloudContextApproved,
  });

  if (mode === "cloud") {
    const leakWarnings = scanPromptForPrivateDataLeak(assembled.prompt);
    if (leakWarnings.length > 0) {
      return {
        success: false,
        providerUsed: "cloud",
        error: `Cloud-Prompt enthält möglicherweise private Daten: ${leakWarnings.join(", ")}`,
      };
    }
  }

  const providerRequest: ImageStudioRequest = {
    ...request,
    prompt: assembled.prompt,
  };

  if (mode === "local_rtx") {
    return runLocalImageTask(resolvedConfig, providerRequest);
  }

  return callCloudImageApi(resolvedConfig, providerRequest);
}

export const IMAGE_STUDIO_TASK_LABELS: Record<ImageStudioTask, string> = {
  generate: "Bild generieren",
  edit: "Bild bearbeiten",
  inpaint: "Inpainting (Maske)",
  remove_background: "Hintergrund entfernen",
  variant: "Variante erstellen",
};
