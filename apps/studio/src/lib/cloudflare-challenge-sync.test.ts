import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setRuntimeEnvOverrides } from "@uwe/auth";
import { DEFAULT_MANAGED_CHALLENGE_SKIP_PATHS } from "@uwe/cloudflare-edge";
import {
  DEFAULT_DEPLOYMENT_SETTINGS,
  normalizeDeploymentSettings,
  type DeploymentSettings,
} from "@uwe/database/deployment";

import { managedChallengeConfigFromSettings } from "./cloudflare-challenge-sync";

/** Deployment settings with the runtime overlay left alone (env drives the URLs). */
function settings(overrides: Partial<DeploymentSettings> = {}): DeploymentSettings {
  setRuntimeEnvOverrides(null);
  return normalizeDeploymentSettings({ ...DEFAULT_DEPLOYMENT_SETTINGS, ...overrides });
}

const SPLIT_HOSTNAME_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PUBLIC_BASE_URL: "https://uweanddragons.org",
  NEXT_PUBLIC_STUDIO_URL: "https://studio.uweanddragons.org",
  NEXT_PUBLIC_PORTAL_URL: "https://portal.uweanddragons.org",
};

describe("managedChallengeConfigFromSettings", () => {
  it("derives the hostnames from the configured origins when none are listed", () => {
    const config = managedChallengeConfigFromSettings(
      settings({ managedChallengeEnabled: true }),
      SPLIT_HOSTNAME_ENV,
    );

    assert.equal(config.enabled, true);
    assert.deepEqual(config.hostnames, [
      "portal.uweanddragons.org",
      "studio.uweanddragons.org",
      "uweanddragons.org",
    ]);
  });

  it("prefers an explicit hostname list over the derived origins", () => {
    const config = managedChallengeConfigFromSettings(
      settings({
        managedChallengeEnabled: true,
        managedChallengeHostnames: ["studio.uweanddragons.org"],
      }),
      SPLIT_HOSTNAME_ENV,
    );

    assert.deepEqual(config.hostnames, ["studio.uweanddragons.org"]);
  });

  it("always keeps the machine-client exemptions and appends the owner's", () => {
    const config = managedChallengeConfigFromSettings(
      settings({
        managedChallengeEnabled: true,
        managedChallengeSkipPaths: ["/api/webhooks"],
      }),
      SPLIT_HOSTNAME_ENV,
    );

    for (const path of DEFAULT_MANAGED_CHALLENGE_SKIP_PATHS) {
      assert.ok(config.skipPaths.includes(path), `expected ${path} to stay exempt`);
    }
    assert.ok(config.skipPaths.includes("/api/webhooks"));
  });

  it("cannot be tricked into exempting nothing", () => {
    const config = managedChallengeConfigFromSettings(
      settings({ managedChallengeEnabled: true, managedChallengeSkipPaths: [] }),
      SPLIT_HOSTNAME_ENV,
    );

    assert.deepEqual(config.skipPaths, [...DEFAULT_MANAGED_CHALLENGE_SKIP_PATHS].sort());
  });

  it("stays disabled by default, so upgrading never locks anybody out", () => {
    const config = managedChallengeConfigFromSettings(settings(), SPLIT_HOSTNAME_ENV);
    assert.equal(config.enabled, false);
  });

  it("drops unusable origins instead of emitting a broken rule", () => {
    const config = managedChallengeConfigFromSettings(
      settings({ managedChallengeEnabled: true }),
      { NODE_ENV: "test", PUBLIC_BASE_URL: "http://localhost:3000" },
    );

    assert.deepEqual(config.hostnames, [], "localhost is not a Cloudflare-routable host");
  });

  it("passes the strict challenge level through", () => {
    const config = managedChallengeConfigFromSettings(
      settings({ managedChallengeEnabled: true, managedChallengeAction: "js_challenge" }),
      SPLIT_HOSTNAME_ENV,
    );

    assert.equal(config.action, "js_challenge");
  });
});
