import path from "node:path";

import { applyBundleInstall, type BundleUpdateResult } from "./bundle-update.ts";
import {
  bundleInstallRoot,
  commandCenterDataRoot,
  detectHostMode,
  resolveDesktopHostRoot,
} from "./desktop-host-paths.ts";
import { collectDesktopHostStatus, getInstallSelection, setupHost } from "./desktop-host.ts";
import type {
  DesktopHostActionResult,
  DesktopHostStatus,
  HostServiceId,
} from "./desktop-host-types.ts";

/**
 * Die Ersteinrichtung mit derselben Weiche wie `update`: Ein Monorepo-Checkout
 * richtet über pnpm und git ein (`setupHost`), eine Bundle-Installation über den
 * Release-Download (`applyBundleInstall`) — dort gibt es weder pnpm-lock.yaml
 * noch git, `setupHost` scheiterte an `validateRepo` und ließ den
 * Ersteinrichtungs-Assistenten im Bundle-Modus ins Leere laufen.
 *
 * Die App-Auswahl kommt in beiden Welten aus `install-selection.json`, die der
 * Assistent vorher über `set-install-selection` schreibt. Das Ergebnis trägt in
 * beiden Fällen einen `status` — der Assistent liest ihn nach der Einrichtung.
 */

export type SetupActionResult =
  | DesktopHostActionResult
  | (BundleUpdateResult & { status: DesktopHostStatus });

/** Austauschbar für Tests — die echte Einrichtung lädt Bundles aus dem Netz. */
export interface SetupActionDependencies {
  setupHost: (rootInput?: string) => Promise<DesktopHostActionResult>;
  applyBundleInstall: (
    apps: readonly HostServiceId[],
    installRoot: string,
    dataDir: string,
  ) => Promise<BundleUpdateResult>;
  collectStatus: (rootInput?: string) => Promise<DesktopHostStatus>;
}

const defaultDependencies: SetupActionDependencies = {
  setupHost,
  applyBundleInstall,
  collectStatus: collectDesktopHostStatus,
};

export async function runSetupAction(
  rootInput: string | undefined,
  deps: SetupActionDependencies = defaultDependencies,
): Promise<SetupActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  if (detectHostMode(root) === "bundle") {
    const apps = getInstallSelection(rootInput).selection.apps;
    const dataDir = path.join(commandCenterDataRoot(), "data");
    const install = await deps.applyBundleInstall(apps, bundleInstallRoot(), dataDir);
    return { ...install, status: await deps.collectStatus(rootInput) };
  }
  return deps.setupHost(rootInput);
}
