import { getAppRepository } from "@uwe/database/server";
import { StudioCockpitStatusFooter } from "./StudioCockpitStatusFooter";
import {
  StudioAppShell,
  type StudioAppShellProps,
} from "./StudioAppShell";

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

  return (
    <StudioAppShell
      {...props}
      cockpitMode
      unifiedSidebar
      cockpitWorlds={worlds}
      statusFooter={<StudioCockpitStatusFooter />}
    />
  );
}
