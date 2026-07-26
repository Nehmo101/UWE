import { isRtxReadinessReady } from "@uwe/ai-brain";
import {
  isConnectorSttAvailable,
  isConnectorVisionAvailable,
} from "@uwe/ai-brain/router";
import { getSystemSettings, type PrismaClient } from "@uwe/database/server";
import type { AssistantCapabilityView } from "@uwe/brain-assistant/types";

/**
 * What the KI-Chat can actually do right now. Resolved server-side and passed
 * to the client as a prop — Brain has no capability-polling endpoint like
 * Studio's `useAiPromptCapabilities`, and a chat page does not need one.
 *
 * Note that the connector's direct (SSE) registry is per-process and lives in
 * the Studio process, so every Brain call goes through the job queue. A
 * connector running in direct-only mode therefore reports as unavailable here —
 * which is the honest answer, since Brain could not reach it either.
 */
export async function loadAssistantCapabilities(
  db: PrismaClient,
): Promise<AssistantCapabilityView> {
  const settings = await getSystemSettings();
  if (!settings.ai.enabled) {
    return {
      aiEnabled: false,
      localAiReady: false,
      visionAvailable: false,
      sttAvailable: false,
    };
  }

  const [localAiReady, visionAvailable, sttAvailable] = await Promise.all([
    isRtxReadinessReady({ prisma: db }),
    isConnectorVisionAvailable(db),
    isConnectorSttAvailable(db),
  ]);

  return { aiEnabled: true, localAiReady, visionAvailable, sttAvailable };
}
