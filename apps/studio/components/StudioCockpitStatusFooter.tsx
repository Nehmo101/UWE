import { prisma } from "@uwe/database/server";
import { StudioStatusFooter } from "@uwe/shared-ui";
import { getCockpitStatusItems } from "@/src/lib/cockpit-status";

/** Server-rendered cockpit status footer for Studio shells. */
export async function StudioCockpitStatusFooter() {
  const useMockInference = process.env.AI_USE_MOCK === "true";
  const items = await getCockpitStatusItems(prisma, { useMockInference });
  return <StudioStatusFooter items={items} />;
}
