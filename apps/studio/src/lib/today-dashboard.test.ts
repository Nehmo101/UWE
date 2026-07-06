import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateHomelabTodayAlerts } from "@uwe/database/server";
import { resolvePreferredWorldSlug } from "./today-dashboard";

describe("today dashboard preferred world", () => {
  const worlds = [{ slug: "terra" }, { slug: "other-world" }];

  it("prefers settings favoriteWorldSlug over env and terra", () => {
    const slug = resolvePreferredWorldSlug(worlds, {
      favoriteWorldSlug: "other-world",
      env: { PREFERRED_WORLD_SLUG: "terra", NODE_ENV: "test" },
    });
    assert.equal(slug, "other-world");
  });

  it("falls back to PREFERRED_WORLD_SLUG env when settings empty", () => {
    const slug = resolvePreferredWorldSlug(worlds, {
      favoriteWorldSlug: null,
      env: { PREFERRED_WORLD_SLUG: "other-world", NODE_ENV: "test" },
    });
    assert.equal(slug, "other-world");
  });

  it("falls back to terra slug when present without hardcoding as only option", () => {
    const slug = resolvePreferredWorldSlug(worlds, {
      favoriteWorldSlug: null,
      env: { NODE_ENV: "test" },
    });
    assert.equal(slug, "terra");
  });

  it("uses first world when terra is absent", () => {
    const slug = resolvePreferredWorldSlug([{ slug: "custom" }], {
      favoriteWorldSlug: null,
      env: { NODE_ENV: "test" },
    });
    assert.equal(slug, "custom");
  });
});

describe("homelab today alert aggregation", () => {
  it("counts URL warnings and service errors as critical", () => {
    const alerts = aggregateHomelabTodayAlerts({
      hardwareIssues: 0,
      hardwareUrlWarnings: [
        {
          deviceId: "1",
          deviceName: "RTX",
          field: "localUrl",
          url: "https://evil.example",
          message: "public rtx",
        },
      ],
      openSetupSteps: 0,
      serviceStatuses: [
        {
          id: "rtx_connector",
          label: "RTX Host Connector",
          ok: false,
          severity: "error",
          message: "offline",
        },
      ],
      securityChecks: [
        {
          id: "no_public_rtx",
          label: "Keine öffentliche RTX-/Connector-URL",
          ok: false,
          severity: "error",
          message: "blocked",
          manual: false,
        },
      ],
    });

    assert.ok(alerts.criticalCount >= 2);
    assert.equal(alerts.securityIssueCount, 1);
  });
});
