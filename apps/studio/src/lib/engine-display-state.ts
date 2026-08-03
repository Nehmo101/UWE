import { checkEngineReadiness } from "@uwe/ai-brain/router";
import type { PrismaClient } from "@uwe/database/server";
import {
  mapEngineReadinessToConnectorState,
  type StudioEngineDisplayState,
} from "./engine-display-ui";

export type { EngineReadinessSourceLabel, StudioEngineDisplayState } from "./engine-display-ui";
export {
  mapEngineReadinessToConnectorState,
  resolveEngineReadinessSourceLabel,
  engineReadinessNextSteps,
  engineReadinessSourceLabelDe,
} from "./engine-display-ui";

export async function loadStudioEngineDisplayState(
  prisma: PrismaClient,
  options?: { useMock?: boolean },
): Promise<StudioEngineDisplayState> {
  const status = await checkEngineReadiness({ prisma, useMock: options?.useMock });
  return {
    status,
    connectorState: mapEngineReadinessToConnectorState(status),
  };
}
