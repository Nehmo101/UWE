import {
  collectCommandCenterSnapshot,
  DEFAULT_UWE_UNITS,
  type CommandCenterSnapshot,
} from "@uwe/host-monitor";
import { resolveDiskTargets } from "./disk-targets";

export async function collectHostClientSnapshot(
  baseDir?: string,
  nowMs = Date.now(),
): Promise<CommandCenterSnapshot> {
  return collectCommandCenterSnapshot({
    nowMs,
    diskTargets: resolveDiskTargets(baseDir),
    units: DEFAULT_UWE_UNITS,
  });
}
