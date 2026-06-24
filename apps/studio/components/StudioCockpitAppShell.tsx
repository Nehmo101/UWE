import { getAppRepository } from "@uwe/database/server";
import { isDesignV2Enabled } from "@uwe/shared-ui";
import { StudioCockpitStatusFooter } from "./StudioCockpitStatusFooter";
import {
  StudioAppShell,
  type StudioAppShellProps,
} from "./StudioAppShell";
import { StudioAppShellV2 } from "./StudioAppShellV2";

type StudioCockpitAppShellProps = Omit<
  StudioAppShellProps,
  "cockpitMode" | "cockpitWorlds" | "statusFooter" | "unifiedSidebar"
>;

/** Studio module shell with cockpit chrome enabled. */
export async function StudioCockpitAppShell(props: StudioCockpitAppShellProps) {
  let worlds: { name: string; slug: string }[] = [];
  try {
    worlds = (await getAppRepository().listWorlds()).map((world) => ({
      name: world.name,
      slug: world.slug,
    }));
  } catch {
    // Database not ready — shell still renders.
  }

  const shellProps = {
    ...props,
    cockpitMode: true as const,
    unifiedSidebar: true as const,
    cockpitWorlds: worlds,
    statusFooter: <StudioCockpitStatusFooter />,
  };

  if (isDesignV2Enabled()) {
    return <StudioAppShellV2 {...shellProps} />;
  }

  return <StudioAppShell {...shellProps} />;
}
