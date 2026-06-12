/**
 * Provider interface for AI image generation in labels.
 * Implementations can be wired when AI image services are configured.
 */

export interface LabelImageGenerateInput {
  prompt: string;
  worldId: string;
  labelId?: string;
  width?: number;
  height?: number;
}

export interface LabelImageGenerateResult {
  success: boolean;
  assetId?: string;
  error?: string;
  disabled?: boolean;
}

export interface LabelImageProvider {
  readonly name: string;
  readonly enabled: boolean;
  generate(input: LabelImageGenerateInput): Promise<LabelImageGenerateResult>;
}

export class DisabledLabelImageProvider implements LabelImageProvider {
  readonly name = "disabled";
  readonly enabled = false;

  async generate(): Promise<LabelImageGenerateResult> {
    return {
      success: false,
      disabled: true,
      error:
        "Bildgenerierung ist nicht konfiguriert. Setzen Sie LABEL_IMAGE_PROVIDER in .env.",
    };
  }
}

export function resolveLabelImageProvider(): LabelImageProvider {
  const provider = process.env.LABEL_IMAGE_PROVIDER?.trim().toLowerCase();

  if (!provider || provider === "disabled" || provider === "none") {
    return new DisabledLabelImageProvider();
  }

  // Future: wire to @uwe/ai-brain image generation when available
  return new DisabledLabelImageProvider();
}

export function isLabelImageGenerationEnabled(): boolean {
  return resolveLabelImageProvider().enabled;
}
