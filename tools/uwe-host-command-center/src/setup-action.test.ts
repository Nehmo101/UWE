import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { bundleInstallRoot } from "./desktop-host-paths";
import type { DesktopHostStatus, HostServiceId } from "./desktop-host-types";
import { writeInstallSelection } from "./install-selection";
import { runSetupAction, type SetupActionDependencies } from "./setup-action";

/**
 * Die Ersteinrichtungs-Weiche: Ein Monorepo-Checkout richtet über `setupHost`
 * ein, eine Bundle-Installation über den Release-Download. Ohne diese Weiche
 * lief `setup` im Bundle-Modus immer in `validateRepo` — der Assistent der
 * Desktop-App war damit tot (genau der Fehler, den diese Tests festnageln).
 */

const temporaryDirectories: string[] = [];
const previousDataDir = process.env.UWE_COMMAND_CENTER_DATA_DIR;
const previousMonorepoRoot = process.env.UWE_MONOREPO_ROOT;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  if (previousDataDir === undefined) delete process.env.UWE_COMMAND_CENTER_DATA_DIR;
  else process.env.UWE_COMMAND_CENTER_DATA_DIR = previousDataDir;
  if (previousMonorepoRoot === undefined) delete process.env.UWE_MONOREPO_ROOT;
  else process.env.UWE_MONOREPO_ROOT = previousMonorepoRoot;
});

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-setup-action-"));
  temporaryDirectories.push(directory);
  return directory;
}

interface RecordedCalls {
  setupRoots: Array<string | undefined>;
  bundleCalls: Array<{ apps: readonly HostServiceId[]; installRoot: string; dataDir: string }>;
  statusRequested: number;
}

function recordingDependencies(): { deps: SetupActionDependencies; calls: RecordedCalls } {
  const calls: RecordedCalls = { setupRoots: [], bundleCalls: [], statusRequested: 0 };
  const status = { overall: "attention" } as DesktopHostStatus;
  const deps: SetupActionDependencies = {
    setupHost: (rootInput) => {
      calls.setupRoots.push(rootInput);
      return Promise.resolve({ ok: true, message: "Checkout eingerichtet.", status });
    },
    applyBundleInstall: (apps, installRoot, dataDir) => {
      calls.bundleCalls.push({ apps, installRoot, dataDir });
      return Promise.resolve({
        ok: true,
        message: "Bundles installiert.",
        updatedApps: [...apps],
        fromVersion: null,
        toVersion: "0.2.0",
      });
    },
    collectStatus: () => {
      calls.statusRequested += 1;
      return Promise.resolve(status);
    },
  };
  return { deps, calls };
}

describe("runSetupAction", () => {
  it("richtet eine Bundle-Installation über den Release-Download ein, mit der gespeicherten Auswahl", async () => {
    const dataRoot = path.join(temporaryDirectory(), "host");
    process.env.UWE_COMMAND_CENTER_DATA_DIR = dataRoot;
    // Kein pnpm-workspace.yaml am Root: das ist eine Bundle-Installation.
    const installRootHint = temporaryDirectory();
    process.env.UWE_MONOREPO_ROOT = installRootHint;
    writeInstallSelection(dataRoot, { apps: ["studio", "brain"] });

    const { deps, calls } = recordingDependencies();
    const result = await runSetupAction(undefined, deps);

    assert.equal(calls.setupRoots.length, 0, "setupHost darf im Bundle-Modus nie laufen");
    assert.equal(calls.bundleCalls.length, 1);
    assert.deepEqual(calls.bundleCalls[0]?.apps, ["studio", "brain"]);
    assert.equal(calls.bundleCalls[0]?.installRoot, bundleInstallRoot());
    assert.equal(calls.bundleCalls[0]?.dataDir, path.join(dataRoot, "data"));
    assert.equal(result.ok, true);
    // Der Assistent liest nach der Einrichtung `status` — auch im Bundle-Modus.
    assert.ok("status" in result && result.status);
    assert.equal(calls.statusRequested, 1);
  });

  it("nutzt im Bundle-Modus die Vorgabe „alle Apps“, solange keine Auswahl geschrieben wurde", async () => {
    process.env.UWE_COMMAND_CENTER_DATA_DIR = path.join(temporaryDirectory(), "host");
    process.env.UWE_MONOREPO_ROOT = temporaryDirectory();

    const { deps, calls } = recordingDependencies();
    await runSetupAction(undefined, deps);

    assert.deepEqual(calls.bundleCalls[0]?.apps, ["studio", "portal", "brain", "family", "landing"]);
  });

  it("richtet einen Monorepo-Checkout weiter über setupHost ein", async () => {
    process.env.UWE_COMMAND_CENTER_DATA_DIR = path.join(temporaryDirectory(), "host");
    const repo = temporaryDirectory();
    fs.writeFileSync(path.join(repo, "pnpm-workspace.yaml"), "packages: []\n", "utf8");
    process.env.UWE_MONOREPO_ROOT = repo;

    const { deps, calls } = recordingDependencies();
    const result = await runSetupAction(repo, deps);

    assert.equal(calls.bundleCalls.length, 0, "der Release-Download gehört nicht in den Checkout-Weg");
    assert.deepEqual(calls.setupRoots, [repo]);
    assert.equal(result.ok, true);
  });
});
