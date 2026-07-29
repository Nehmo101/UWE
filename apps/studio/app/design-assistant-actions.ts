"use server";

import { requireStudioAiActionAuth } from "@/src/lib/studio-action-auth";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { createUweRepository } from "@uwe/database/server";
import { executeAiGatewayRequest } from "@uwe/ai-brain";
import {
  runThemeGeneratorTurn,
  type ThemeChatMessage,
  type ThemeGeneratorTurnResult,
} from "@uwe/ai-brain/theme-generator";

export interface DesignAssistantTurnRequest {
  history: ThemeChatMessage[];
  userMessage: string;
  scope: "studio" | "portal" | "both";
  variantCount?: number;
}

/**
 * Runs one turn of the conversational design assistant through the AI gateway
 * (contextMode `general_chat`, local-first via provider `auto`). Design chat is
 * generic content, so it carries no campaign/brain context and won't trip the
 * local-only privacy guards. The strict-JSON contract lives in the generator's
 * prompt, which is folded into `userPrompt` because general_chat supplies its
 * own generic system prompt.
 */
export async function runDesignAssistantTurnAction(
  request: DesignAssistantTurnRequest,
): Promise<ThemeGeneratorTurnResult> {
  await requireStudioAiActionAuth();
  const currentUser = await getCurrentAuthUser();
  const user = { userId: currentUser?.id ?? "system" };

  return runThemeGeneratorTurn(
    {
      history: request.history,
      userMessage: request.userMessage,
      scope: request.scope,
      variantCount: request.variantCount,
    },
    async ({ system, user: userPrompt }) => {
      const routed = await executeAiGatewayRequest(
        { repo: createUweRepository() },
        {
          user,
          providerMode: "local_rtx",
          contextMode: "general_chat",
          taskType: "generate_theme_palette",
          feature: "AI_KNOWLEDGE_USE",
          // general_chat uses its own generic system prompt, so the design
          // contract (strict JSON + token list) is folded into the user turn.
          userPrompt: `${system}\n\n${userPrompt}`,
        },
      );
      return routed.result.text;
    },
  );
}
