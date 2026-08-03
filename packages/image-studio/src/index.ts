/**
 * UWE Image Studio — Bildgenerierung und -bearbeitung über den lokalen Maschinenraum-Host.
 *
 * Es gibt genau einen Weg: die outbound Connector-Queue zum Maschinenraum-Host. Der
 * frühere OpenAI-Pfad ist mit Notiz Lasse (N.3) ersatzlos entfallen — „alles
 * was KI-Aktionen sind, geht rein über den Maschinenraum". Ohne Connector ist Image
 * Studio schlicht nicht verfügbar; ein Ausweichweg wäre genau der Cloud-Weg,
 * den es nicht mehr geben soll.
 */

export type ImageProviderMode = "local_engine" | "disabled";

export type ImageStudioTask =
  | "generate"
  | "edit"
  | "inpaint"
  | "remove_background"
  | "variant";

import {
  assembleImageStudioPrompt,
  type ImageStudioPromptContextMode,
} from "./prompt-privacy";

export type { ImageStudioPromptContextMode } from "./prompt-privacy";
export {
  assembleImageStudioPrompt,
  ImageStudioPrivacyError,
  isLocalOnlyImageContext,
  scanPromptForPrivateDataLeak,
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
 * Vom Host eingehängte Brücke, die einen `image_generate`-Job über die
 * outbound Maschinenraum-Queue schickt. Der Host hat DB- und Queue-Zugriff,
 * dieses Paket bleibt dadurch abhängigkeitsfrei.
 */
export type ConnectorImageGenerate = (
  request: ImageStudioRequest,
) => Promise<ImageStudioResult>;

export interface ImageStudioProviderConfig {
  enabled: boolean;
  /** Connector-Queue bevorzugen (vom Host zur Laufzeit gesetzt). */
  useConnectorImage?: boolean;
  /** Vom Host eingehängte Queue-Brücke (siehe {@link ConnectorImageGenerate}). */
  connectorImageGenerate?: ConnectorImageGenerate;
}

export function resolveImageProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): ImageStudioProviderConfig {
  return {
    enabled: env.IMAGE_STUDIO_ENABLED !== "false",
    useConnectorImage: env.ENGINE_USE_CONNECTOR_IMAGE !== "false",
  };
}

/** Ein lokales Bild-Backend hängt an der outbound Connector-Queue. */
function hasLocalImageBackend(config: ImageStudioProviderConfig): boolean {
  return Boolean(config.useConnectorImage && config.connectorImageGenerate);
}

function resolveProvider(config: ImageStudioProviderConfig): ImageProviderMode {
  if (!config.enabled) return "disabled";
  return hasLocalImageBackend(config) ? "local_engine" : "disabled";
}

async function runLocalImageTask(
  config: ImageStudioProviderConfig,
  request: ImageStudioRequest,
): Promise<ImageStudioResult> {
  if (config.connectorImageGenerate) {
    return config.connectorImageGenerate(request);
  }
  return {
    success: false,
    providerUsed: "local_engine",
    error:
      "Kein lokales Bild-Backend: Maschinenraum mit image_generation erforderlich (outbound Connector-Queue).",
  };
}

export async function runImageStudioTask(
  request: ImageStudioRequest,
  config?: ImageStudioProviderConfig,
): Promise<ImageStudioResult> {
  const resolvedConfig = config ?? resolveImageProviderConfig();
  const mode = resolveProvider(resolvedConfig);

  if (mode === "disabled") {
    return {
      success: false,
      providerUsed: "disabled",
      error:
        "Image Studio nicht verfügbar — der Maschinenraum (image_generation) ist offline.",
    };
  }

  const assembled = assembleImageStudioPrompt({
    prompt: request.prompt,
    contextMode: request.contextMode,
    contextSnippet: request.contextSnippet,
  });

  return runLocalImageTask(resolvedConfig, { ...request, prompt: assembled.prompt });
}

export const IMAGE_STUDIO_TASK_LABELS: Record<ImageStudioTask, string> = {
  generate: "Bild generieren",
  edit: "Bild bearbeiten",
  inpaint: "Inpainting (Maske)",
  remove_background: "Hintergrund entfernen",
  variant: "Variante erstellen",
};
