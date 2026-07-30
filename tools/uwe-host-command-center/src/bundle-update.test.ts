import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import type { ReleaseManifestV2 } from "./bundle-install";
import {
  commandCenterInstallerUrl,
  evaluateBundleUpdate,
  readInstalledState,
  writeInstalledState,
} from "./bundle-update";

/**
 * Der Update-Weg der Bundle-Installation kennt kein git: Was „neu" ist, sagt
 * allein das Manifest des neuesten Release-Tags. Diese Tests nageln das Urteil
 * fest — inklusive der Fälle, in denen sich nur die Desktop-App bewegt hat.
 */

function manifest(overrides: Partial<ReleaseManifestV2> = {}): ReleaseManifestV2 {
  return {
    schemaVersion: 2,
    version: "0.2.0",
    tag: "uwe-v0.2.0",
    windows: { nsis: "UWE_Command_Center_0.2.0_x64-setup.exe", msi: null },
    apps: {
      studio: { file: "uwe-studio-0.2.0.tar.gz", sha256: "neu-studio", size: 10 },
      portal: { file: "uwe-portal-0.2.0.tar.gz", sha256: "neu-portal", size: 10 },
    },
    ...overrides,
  };
}

describe("bundle update evaluation", () => {
  it("reports no update when version and every bundle checksum match", () => {
    const check = evaluateBundleUpdate(
      manifest(),
      { version: "0.2.0", appHashes: { studio: "neu-studio", portal: "neu-portal" } },
      ["studio", "portal"],
    );
    assert.equal(check.updateAvailable, false);
    assert.deepEqual(check.changedApps, []);
    assert.match(check.message, /aktuell \(uwe-v0\.2\.0\)/);
  });

  it("lists only the apps whose checksum changed", () => {
    const check = evaluateBundleUpdate(
      manifest(),
      { version: "0.1.0", appHashes: { studio: "alt-studio", portal: "neu-portal" } },
      ["studio", "portal"],
    );
    assert.equal(check.updateAvailable, true);
    assert.deepEqual(check.changedApps, ["studio"]);
    assert.equal(check.installedVersion, "0.1.0");
    assert.equal(check.latestTag, "uwe-v0.2.0");
    assert.match(check.message, /studio/);
  });

  it("still reports an update when only the release version moved", () => {
    // Ein Nachbau derselben Bundles unter neuer Version: kein Download nötig,
    // aber der Stand ist ein anderer — sonst bliebe der Nutzer auf 0.1.0 stehen.
    const check = evaluateBundleUpdate(
      manifest(),
      { version: "0.1.0", appHashes: { studio: "neu-studio", portal: "neu-portal" } },
      ["studio", "portal"],
    );
    assert.equal(check.updateAvailable, true);
    assert.deepEqual(check.changedApps, []);
  });

  it("ignores apps the release does not carry a bundle for", () => {
    const check = evaluateBundleUpdate(
      manifest(),
      { version: "0.2.0", appHashes: {} },
      ["studio", "portal", "brain"],
    );
    assert.deepEqual(check.changedApps, ["studio", "portal"]);
    assert.ok(!check.changedApps.includes("brain" as never));
  });

  it("surfaces the installer file name from the manifest", () => {
    assert.equal(
      evaluateBundleUpdate(manifest(), { version: null, appHashes: {} }, []).installerFile,
      "UWE_Command_Center_0.2.0_x64-setup.exe",
    );
    assert.equal(
      evaluateBundleUpdate(manifest({ windows: undefined }), { version: null, appHashes: {} }, [])
        .installerFile,
      null,
    );
  });
});

describe("command center installer url", () => {
  const vorher = process.env.UWE_COMMAND_CENTER_VERSION;
  after(() => {
    if (vorher === undefined) delete process.env.UWE_COMMAND_CENTER_VERSION;
    else process.env.UWE_COMMAND_CENTER_VERSION = vorher;
  });

  it("points at the release asset when the running app is behind", () => {
    process.env.UWE_COMMAND_CENTER_VERSION = "0.1.0";
    assert.equal(
      commandCenterInstallerUrl(manifest()),
      "https://github.com/Nehmo101/UWE/releases/download/uwe-v0.2.0/UWE_Command_Center_0.2.0_x64-setup.exe",
    );
  });

  it("stays silent when the app is current or ahead", () => {
    process.env.UWE_COMMAND_CENTER_VERSION = "0.2.0";
    assert.equal(commandCenterInstallerUrl(manifest()), null);
    process.env.UWE_COMMAND_CENTER_VERSION = "0.3.0";
    assert.equal(commandCenterInstallerUrl(manifest()), null);
  });

  it("stays silent when the running version is unknown", () => {
    // Kein durchgereichtes UWE_COMMAND_CENTER_VERSION: lieber kein Hinweis als
    // ein ungefragt gestarteter Installer.
    delete process.env.UWE_COMMAND_CENTER_VERSION;
    assert.equal(commandCenterInstallerUrl(manifest()), null);
  });
});

describe("installed release state", () => {
  const werk = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-bundle-state-"));
  after(() => fs.rmSync(werk, { recursive: true, force: true }));

  it("round-trips version and per-app checksums", () => {
    assert.deepEqual(readInstalledState(werk), { version: null, appHashes: {} });
    writeInstalledState(werk, manifest(), ["studio"]);
    assert.deepEqual(readInstalledState(werk), {
      version: "0.2.0",
      appHashes: { studio: "neu-studio" },
    });

    // Ein zweiter Lauf ergänzt, statt den Stand der anderen Apps zu vergessen.
    writeInstalledState(werk, manifest(), ["portal"]);
    assert.deepEqual(readInstalledState(werk).appHashes, {
      studio: "neu-studio",
      portal: "neu-portal",
    });
  });
});
