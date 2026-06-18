import type { PrismaClient } from "@uwe/database/server";
import { resolveLocalOnlyMode, getSystemSettings } from "@uwe/database/server";
import { buildCookbookRuntimeProbe } from "@uwe/ai-brain/cookbook-bridge";
import { getCookbookDashboard, type CookbookDashboard } from "@uwe/cookbook";

export async function getStudioCookbookDashboard(
  db: PrismaClient,
  options: { useMockInference?: boolean } = {},
): Promise<CookbookDashboard> {
  const settings = await getSystemSettings(db);
  const probe = await buildCookbookRuntimeProbe({ useMock: options.useMockInference });

  return getCookbookDashboard({
    probe,
    localOnlyMode: resolveLocalOnlyMode(settings),
  });
}

export type { CookbookDashboard };
