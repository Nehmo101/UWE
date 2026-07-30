import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMockHostStatus } from "../../lib/tauri-mock-host";
import { commandCenterGuidance } from "./view-model";

describe("commandCenterGuidance", () => {
  it("recommends starting a configured, stopped host", () => {
    const guidance = commandCenterGuidance(buildMockHostStatus(false));

    assert.equal(guidance.primaryAction, "start");
    assert.equal(guidance.title, "UWE ist derzeit offline");
  });

  it("turns the main action into a useful Studio shortcut when everything is online", () => {
    const guidance = commandCenterGuidance(buildMockHostStatus(true));

    assert.equal(guidance.primaryAction, "open");
    assert.equal(guidance.tone, "ready");
  });

  it("opens the first installed area when Studio is not part of the selection", () => {
    const status = buildMockHostStatus(true);
    status.services = status.services.filter((service) => service.id === "portal");

    assert.equal(commandCenterGuidance(status).primaryLabel, "Portal öffnen");
  });
  it("prioritizes setup when the production build is missing", () => {
    const status = buildMockHostStatus(false);
    status.installation.buildReady = false;

    assert.equal(commandCenterGuidance(status).primaryAction, "setup");
  });
});
