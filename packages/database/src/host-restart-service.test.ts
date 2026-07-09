import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HostRestartError,
  resolveHostRestartAvailability,
} from "./host-restart-service";

describe("host-restart-service", () => {
  it("is disabled when env flag is missing", async () => {
    const previous = process.env.UWE_HOST_RESTART_ENABLED;
    delete process.env.UWE_HOST_RESTART_ENABLED;

    try {
      const availability = await resolveHostRestartAvailability();
      assert.equal(availability.enabled, false);
      assert.equal(availability.available, false);
      assert.match(availability.reason ?? "", /UWE_HOST_RESTART_ENABLED/);
    } finally {
      if (previous === undefined) {
        delete process.env.UWE_HOST_RESTART_ENABLED;
      } else {
        process.env.UWE_HOST_RESTART_ENABLED = previous;
      }
    }
  });

  it("exposes HostRestartError status codes", () => {
    const error = new HostRestartError("test", 503);
    assert.equal(error.status, 503);
    assert.equal(error.name, "HostRestartError");
  });
});
