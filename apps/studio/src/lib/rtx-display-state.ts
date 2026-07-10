import { checkRtxReadiness } from "@uwe/ai-brain/router";
import type { PrismaClient } from "@uwe/database/server";
import {
  mapRtxReadinessToConnectorState,
  type StudioRtxDisplayState,
} from "./rtx-display-ui";

export type { RtxReadinessSourceLabel, StudioRtxDisplayState } from "./rtx-display-ui";
export {
  mapRtxReadinessToConnectorState,
  resolveRtxReadinessSourceLabel,
  rtxReadinessNextSteps,
  rtxReadinessSourceLabelDe,
} from "./rtx-display-ui";

export async function loadStudioRtxDisplayState(
  prisma: PrismaClient,
  options?: { useMock?: boolean },
): Promise<StudioRtxDisplayState> {
  const status = await checkRtxReadiness({ prisma, useMock: options?.useMock });
  return {
    status,
    connectorState: mapRtxReadinessToConnectorState(status),
  };
}
