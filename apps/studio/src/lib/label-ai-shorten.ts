import {
  createApiKeyStoreFromEnv,
  createProvider,
  resolveAiBrainSettings,
} from "@uwe/ai-brain";

const SHORTEN_PROMPT = `Kürze den folgenden Text für ein 6×4-Zoll Spieler-Handout.
Regeln:
- Nur den gekürzten Text ausgeben, ohne Erklärung.
- Keine DM-Geheimnisse erfinden oder hinzufügen.
- Spieler-taugliche Sprache beibehalten.
- Maximal etwa 40 % kürzer als das Original.

Text:
`;

export async function tryAiShortenLabelText(
  text: string,
  options: { localOnly?: boolean } = {},
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const settings = resolveAiBrainSettings(createApiKeyStoreFromEnv(), {
      enabled: process.env.AI_BRAIN_ENABLED !== "false",
      localOnly: options.localOnly,
    });

    if (!settings.enabled) return null;

    const providerId = settings.defaultProvider;
    const provider = createProvider(providerId, createApiKeyStoreFromEnv(), {
      useMock: process.env.AI_USE_MOCK === "true",
    });

    const health = await provider.healthCheck();
    if (!health.ok) return null;

    const models = await provider.listModels();
    const model = models[0]?.id;
    if (!model) return null;

    const response = await provider.generateText({
      model,
      prompt: `${SHORTEN_PROMPT}${trimmed}`,
      maxTokens: 800,
      temperature: 0.3,
    });

    const shortened = response.text.trim();
    if (!shortened || shortened.length >= trimmed.length) return null;
    return shortened;
  } catch {
    return null;
  }
}

export function isLabelAiShortenAvailable(): boolean {
  return process.env.AI_BRAIN_ENABLED !== "false";
}
