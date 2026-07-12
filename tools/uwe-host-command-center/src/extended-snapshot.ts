import type { CommandCenterSnapshot } from "@uwe/host-monitor";
import { collectHostClientSnapshot } from "./snapshot";
import { collectConfigFacts, type ConfigFactsSnapshot } from "./config-facts";
import { getControlMeta, type ControlMeta } from "./control";
import { getHostUpdateProgress, type HostUpdateProgress } from "./host-update-progress";
import { collectServiceJournal, type ServiceJournalSnapshot } from "./service-journal";
import { collectUweReachability, type UweReachability } from "./uwe-health";

export interface ExtendedCommandCenterSnapshot extends CommandCenterSnapshot {
  uwe: UweReachability;
  config: ConfigFactsSnapshot;
  journal: ServiceJournalSnapshot;
  control: ControlMeta;
  hostUpdate: HostUpdateProgress;
}

export async function collectExtendedSnapshot(baseDir?: string): Promise<ExtendedCommandCenterSnapshot> {
  const [host, uwe, config, journal, control, hostUpdate] = await Promise.all([
    collectHostClientSnapshot(baseDir),
    collectUweReachability(),
    collectConfigFacts(),
    collectServiceJournal(),
    getControlMeta(),
    getHostUpdateProgress(),
  ]);

  return {
    ...host,
    uwe,
    config,
    journal,
    control,
    hostUpdate,
  };
}
