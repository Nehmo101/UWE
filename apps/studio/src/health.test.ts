import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UWE_PRODUCT_NAME, UWE_VERSION } from "@uwe/database/server";
import { requirePrivateHealthAuth } from "./lib/private-health-auth";

describe("studio health detail gating", () => {
  // The fat /api/health route serves operational detail only when this guard
  // returns null (valid STUDIO_API_TOKEN); otherwise it falls back to a slim
  // liveness+identity payload. These cases pin that decision.
  const withToken = (token: string, header?: string) => {
    const previous = process.env.STUDIO_API_TOKEN;
    process.env.STUDIO_API_TOKEN = token;
    try {
      const req = new Request("http://studio.test/api/health", {
        headers: header ? { authorization: header } : {},
      });
      return requirePrivateHealthAuth(req) === null;
    } finally {
      if (previous === undefined) delete process.env.STUDIO_API_TOKEN;
      else process.env.STUDIO_API_TOKEN = previous;
    }
  };

  it("withholds detail from anonymous callers", () => {
    assert.equal(withToken("s3cret-token-value", undefined), false);
  });

  it("withholds detail for a wrong token", () => {
    assert.equal(withToken("s3cret-token-value", "Bearer nope"), false);
  });

  it("serves detail with the correct bearer token", () => {
    assert.equal(withToken("s3cret-token-value", "Bearer s3cret-token-value"), true);
  });
});

describe("studio health response shape", () => {
  it("defines expected health payload fields", () => {
    const payload = {
      status: "ok",
      app: {
        name: "UWE Studio",
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
          databaseFileExists: true,
          paths: {
            dataDir: "/data",
            uploadsDir: "/data/uploads",
            backupsDir: "/data/backups",
            exportsDir: "/exports",
          },
          message: "ok",
        },
      },
      trust: {
        studioLogin: "session-login",
        studioApiTokenConfigured: true,
      },
      proxy: {
        publicAppUrl: "https://uwe.example",
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
    assert.equal(payload.app.name, "UWE Studio");
    assert.equal(payload.proxy.trustProxy, true);
    assert.equal(payload.app.product, "Universeller Welten-Editor");
    assert.match(payload.app.version, /^\d+\.\d+\.\d+$/);
    assert.equal(payload.checks.storage.exportsWritable, true);
  });
});
