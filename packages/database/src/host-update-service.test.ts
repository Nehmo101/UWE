import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HostUpdateError,
  isHostUpdateRequestFresh,
  resolveHostUpdateAvailability,
} from "./host-update-service";

describe("host-update-service", () => {
  it("resolveHostUpdateAvailability reports disabled when env flag is off", async () => {
    const previous = process.env.UWE_HOST_UPDATE_ENABLED;
    process.env.UWE_HOST_UPDATE_ENABLED = "false";
    try {
      const availability = await resolveHostUpdateAvailability();
      assert.equal(availability.enabled, false);
      assert.equal(availability.available, false);
      assert.match(availability.reason ?? "", /deaktiviert/i);
    } finally {
      if (previous === undefined) {
        delete process.env.UWE_HOST_UPDATE_ENABLED;
      } else {
        process.env.UWE_HOST_UPDATE_ENABLED = previous;
      }
    }
  });

  it("isHostUpdateRequestFresh accepts recent timestamps only", () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    const stale = new Date(Date.now() - 20 * 60_000).toISOString();
    assert.equal(isHostUpdateRequestFresh(recent), true);
    assert.equal(isHostUpdateRequestFresh(stale), false);
    assert.equal(isHostUpdateRequestFresh("not-a-date"), false);
  });

  it("HostUpdateError carries HTTP status", () => {
    const error = new HostUpdateError("blocked", 409);
    assert.equal(error.status, 409);
    assert.equal(error.name, "HostUpdateError");
  });
});
