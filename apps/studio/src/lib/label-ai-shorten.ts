import { executeAiGatewayRequest } from "@uwe/ai-brain";
import { createAiGatewayService, createUweRepository, prisma } from "@uwe/database/server";

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
  options: { userId?: string; role?: string } = {},
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed || !options.userId || !options.role) {
    return null;
  }

  try {
    const gatewayService = createAiGatewayService(prisma);
    const result = await executeAiGatewayRequest(
      { gatewayService, repo: createUweRepository() },
      {
        user: { userId: options.userId, role: options.role },
        providerMode: "local_rtx",
        contextMode: "general_chat",
        taskType: "summarize_page",
        userPrompt: `${SHORTEN_PROMPT}${trimmed}`,
        useMock: process.env.AI_USE_MOCK === "true",
        feature: "AI_SUMMARY_USE",
        options: {
          localOnly: true,
          datenschutzMode: true,
        },
      },
    );

    const shortened = result.result.text.trim();
    if (!shortened || shortened.length >= trimmed.length) {
      return null;
    }
    return shortened;
  } catch {
    return null;
  }
}

export function isLabelAiShortenAvailable(): boolean {
  return process.env.AI_BRAIN_ENABLED !== "false";
}
