import { getAppRepository, prisma } from "@uwe/database/server";
import { StudioStatusFooter } from "@uwe/shared-ui";
import { getCockpitStatusItems } from "@/src/lib/cockpit-status";
import {
  WorldModuleShell,
  type WorldModuleShellProps,
} from "./WorldModuleShell";

type WorldCockpitShellProps = Omit<
  WorldModuleShellProps,
  "cockpitMode" | "cockpitWorlds" | "statusFooter" | "unifiedSidebar"
>;

/** World shell with cockpit chrome — world switcher, unified sidebar, status footer. */
export async function WorldCockpitShell(props: WorldCockpitShellProps) {
  const useMockInference = process.env.AI_USE_MOCK === "true";
  const [worlds, statusItems] = await Promise.all([
    getAppRepository().listWorlds(),
    getCockpitStatusItems(prisma, { useMockInference }),
  ]);

  return (
    <WorldModuleShell
      {...props}
      cockpitMode
      unifiedSidebar
      cockpitWorlds={worlds.map((world) => ({ name: world.name, slug: world.slug }))}
      statusFooter={<StudioStatusFooter items={statusItems} />}
    />
  );
}
