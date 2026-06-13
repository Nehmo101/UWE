import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UWE_PRODUCT_NAME, UWE_VERSION } from "@uwe/database/server";

describe("portal health response shape", () => {
  it("defines expected health payload fields", () => {
    const payload = {
      status: "ok",
      app: {
        name: "UWE Portal",
        product: UWE_PRODUCT_NAME,
        version: UWE_VERSION,
        runtime: {
          ok: true,
          nodeEnv: "test",
          production: false,
        },
      },
      checks: {
        storage: {
          ok: true,
          uploadsWritable: true,
          backupsWritable: true,
          exportsWritable: true,
          databaseFileExists: null,
          paths: {
            dataDir: "/data",
            uploadsDir: "/data/uploads",
            backupsDir: "/data/backups",
            exportsDir: "/exports",
          },
          message: "ok",
        },
      },
      rateLimiter: { mode: "in-memory" },
      proxy: {
        publicAppUrl: "https://uweandragons.org",
        trustProxy: true,
        cloudflareTunnel: true,
        authRequired: true,
        sessionCookieSecure: true,
        playerPreviewPublic: false,
        playerPreviewRequireToken: true,
        playerPreviewAllowDmOnly: false,
        publicExposureConfigured: true,
      },
    };

    assert.equal(payload.status, "ok");
    assert.equal(payload.app.name, "UWE Portal");
    assert.equal(payload.proxy.authRequired, true);
    assert.equal(payload.app.product, "Universeller Welten-Editor");
    assert.match(payload.app.version, /^\d+\.\d+\.\d+$/);
    assert.equal(payload.checks.storage.exportsWritable, true);
  });
});
