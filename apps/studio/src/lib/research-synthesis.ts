import {
  buildResearchSynthesisPrompt,
  executeAiGatewayRequest,
  type ResearchSourceInput,
} from "@uwe/ai-brain";
import {
  createBrainStoreService,
  createUweRepository,
  prisma,
  type PrismaClient,
} from "@uwe/database/server";
import { loadStudioPersonalBrainPromptContext } from "./personal-brain-ai-context";

export type ResearchContextMode = "dnd_brain" | "life_brain" | "open_web";

export interface SynthesizeResearchInput {
  user: { userId: string; role: string };
  query: string;
  results: ResearchSourceInput[];
  contextMode: ResearchContextMode;
  worldId?: string | null;
  useMock?: boolean;
}

/**
 * LLM synthesis of web-search results via the AI gateway.
 * - life_brain → personal_brain context (local-only, no cloud fallback)
 * - dnd_brain + world → brain context of that world
 * - open_web → general chat without local context
 */
export async function synthesizeResearchReportViaGateway(
  db: PrismaClient,
  input: SynthesizeResearchInput,
): Promise<string> {
  const userPrompt = buildResearchSynthesisPrompt(input.query, input.results);

  let contextMode: "personal_brain" | "brain" | "general_chat" = "general_chat";
  let worldSlug: string | undefined;

  if (input.contextMode === "life_brain") {
    contextMode = "personal_brain";
  } else if (input.contextMode === "dnd_brain" && input.worldId) {
    const world = await db.world.findUnique({
      where: { id: input.worldId },
      select: { slug: true },
    });
    if (world) {
      contextMode = "brain";
      worldSlug = world.slug;
    }
  }

  const feature = input.contextMode === "dnd_brain" ? "AI_DND_USE" : "AI_KNOWLEDGE_USE";

  const routed = await executeAiGatewayRequest(
    {
      repo: createUweRepository(),
      brainStore: createBrainStoreService(),
      loadPersonalBrainContext: () =>
        loadStudioPersonalBrainPromptContext(prisma, {
          query: input.query,
          retrievalLimit: 8,
        }),
    },
    {
      user: input.user,
      providerMode: "local_rtx",
      contextMode,
      taskType: "synthesize_research",
      worldSlug,
      userPrompt,
      useMock: input.useMock,
      feature,
    },
  );

  return routed.result.text;
}
