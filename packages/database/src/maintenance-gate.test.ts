import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateMaintenanceGate,
  isMaintenanceMiddlewareBypassPath,
  resolveMaintenanceGateContext,
} from "./maintenance-gate";
import { DEFAULT_SYSTEM_SETTINGS, type UweSystemSettings } from "./settings-service";

describe("maintenance gate", () => {
  it("allows owner bypass while studio is locked", () => {
    const settings: UweSystemSettings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      maintenance: {
        maintenanceMode: false,
        lockPortal: false,
        lockStudio: true,
        message: "Studio gesperrt",
      },
    };

    const decision = evaluateMaintenanceGate({
      settings,
      surface: "studio",
      pathname: "/today",
      context: resolveMaintenanceGateContext({ userRole: "owner" }),
    });

    assert.equal(decision.blocked, false);
  });

  it("blocks non-owner studio access when lockStudio is active", () => {
    const settings: UweSystemSettings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      maintenance: {
        maintenanceMode: false,
        lockPortal: false,
        lockStudio: true,
        message: "Studio gesperrt",
      },
    };

    const decision = evaluateMaintenanceGate({
      settings,
      surface: "studio",
      pathname: "/today",
      context: resolveMaintenanceGateContext({ userRole: "dm" }),
    });

    assert.equal(decision.blocked, true);
    assert.equal(decision.redirectPath, "/maintenance");
    assert.equal(decision.reason, "lock_studio");
  });

  it("blocks portal when maintenanceMode is active", () => {
    const settings: UweSystemSettings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      maintenance: {
        maintenanceMode: true,
        lockPortal: false,
        lockStudio: false,
        message: "Wartung",
      },
    };

    const decision = evaluateMaintenanceGate({
      settings,
      surface: "portal",
      pathname: "/auth/worlds",
      context: resolveMaintenanceGateContext({ userRole: "player" }),
    });

    assert.equal(decision.blocked, true);
    assert.equal(decision.reason, "maintenance_mode");
    assert.equal(decision.message, "Wartung");
  });

  it("allows maintenance page for non-owners", () => {
    const settings: UweSystemSettings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      maintenance: {
        maintenanceMode: true,
        lockPortal: false,
        lockStudio: false,
        message: "",
      },
    };

    const decision = evaluateMaintenanceGate({
      settings,
      surface: "studio",
      pathname: "/maintenance",
      context: resolveMaintenanceGateContext({ userRole: "player" }),
    });

    assert.equal(decision.blocked, false);
  });

  it("skips middleware fetch for evaluate API path", () => {
    assert.equal(isMaintenanceMiddlewareBypassPath("/api/maintenance/evaluate"), true);
    assert.equal(isMaintenanceMiddlewareBypassPath("/today"), false);
  });
});
