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

  /*
   * Der Kern des Fehlers vom 2026-08-04: Während eines Laufs fehlt zeitweise
   * das Standalone-`server.js` der gerade gebauten App, `buildReady` kippt auf
   * false — und der Hauptknopf lud zu einem zweiten Setup-Lauf ein.
   */
  it("never offers setup while a setup is already running", () => {
    const status = buildMockHostStatus(false);
    status.installation.buildReady = false;
    status.longRun = { action: "setup", pid: 4711, startedAt: "2026-08-04T21:15:20.715Z" };

    const guidance = commandCenterGuidance(status);

    assert.equal(guidance.primaryAction, "wait");
    assert.equal(guidance.title, "UWE wird gerade eingerichtet");
  });

  it("reports a running update even while every area is still online", () => {
    const status = buildMockHostStatus(true);
    status.longRun = { action: "update", pid: 4712, startedAt: "2026-08-04T21:15:20.715Z" };

    const guidance = commandCenterGuidance(status);

    assert.equal(guidance.primaryAction, "wait");
    assert.equal(guidance.title, "UWE wird gerade aktualisiert");
  });
});
