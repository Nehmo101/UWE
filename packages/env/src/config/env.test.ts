import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertProductionEnvReady,
  collectEnvValidationIssues,
  EnvValidationError,
  isWeakSecret,
  parseUweEnv,
} from "./env";

const STRONG_SECRET = "x".repeat(32);
const STRONG_SETUP_TOKEN = "setup-" + "y".repeat(28);

function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void | Promise<void>,
): void | Promise<void> {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("env validation", () => {
  it("rejects weak or short secrets", () => {
    assert.equal(isWeakSecret(undefined), true);
    assert.equal(isWeakSecret("change-me"), true);
    assert.equal(isWeakSecret("short"), true);
    assert.equal(isWeakSecret("uwe-dev"), true);
    assert.equal(isWeakSecret(STRONG_SECRET), false);
  });

  it("does not start production without SESSION_SECRET", () => {
    withEnv(
      {
        NODE_ENV: "production",
        SESSION_SECRET: undefined,
        AUTH_SECRET: undefined,
        UWE_SETUP_TOKEN: STRONG_SETUP_TOKEN,
        PUBLIC_BASE_URL: "https://uwe.example.org",
        DATABASE_URL: "file:./data/uwe.db",
      },
      () => {
        const issues = collectEnvValidationIssues(process.env);
        assert.ok(issues.some((issue) => issue.includes("SESSION_SECRET fehlt")));

        assert.throws(() => parseUweEnv(process.env), EnvValidationError);
        assert.throws(() => assertProductionEnvReady(process.env), EnvValidationError);
      },
    );
  });

  it("rejects production with weak SESSION_SECRET and UWE_SETUP_TOKEN", () => {
    withEnv(
      {
        NODE_ENV: "production",
        SESSION_SECRET: "change-me",
        UWE_SETUP_TOKEN: "test",
        PUBLIC_BASE_URL: "https://uwe.example.org",
        DATABASE_URL: "file:./data/uwe.db",
      },
      () => {
        const issues = collectEnvValidationIssues(process.env);
        assert.ok(issues.some((issue) => issue.includes("SESSION_SECRET ist unsicher")));
        assert.ok(issues.some((issue) => issue.includes("UWE_SETUP_TOKEN ist unsicher")));
      },
    );
  });

  it("accepts valid production configuration", () => {
    withEnv(
      {
        NODE_ENV: "production",
        SESSION_SECRET: STRONG_SECRET,
        UWE_SETUP_TOKEN: STRONG_SETUP_TOKEN,
        PUBLIC_BASE_URL: "https://uwe.example.org",
        DATABASE_URL: "file:/data/uwe.db",
        MAX_UPLOAD_MB: "64",
      },
      () => {
        const config = assertProductionEnvReady(process.env);
        assert.ok(config);
        assert.equal(config?.maxUploadMb, 64);
        assert.equal(config?.sessionSecret, STRONG_SECRET);
      },
    );
  });

  it("allows development without production-only secrets", () => {
    withEnv(
      {
        NODE_ENV: "development",
        SESSION_SECRET: undefined,
        AUTH_SECRET: undefined,
        UWE_SETUP_TOKEN: undefined,
        PUBLIC_BASE_URL: undefined,
        DATABASE_URL: "file:./data/uwe.db",
      },
      () => {
        const issues = collectEnvValidationIssues(process.env);
        assert.equal(issues.length, 0);
        assert.equal(assertProductionEnvReady(process.env), null);
      },
    );
  });

  it("supports legacy AUTH_SECRET alias", () => {
    withEnv(
      {
        NODE_ENV: "production",
        SESSION_SECRET: undefined,
        AUTH_SECRET: STRONG_SECRET,
        UWE_SETUP_TOKEN: STRONG_SETUP_TOKEN,
        PUBLIC_APP_URL: "https://legacy.example.org",
        DATABASE_URL: "file:/data/uwe.db",
      },
      () => {
        const config = parseUweEnv(process.env);
        assert.equal(config.sessionSecret, STRONG_SECRET);
        assert.equal(config.publicBaseUrl, "https://legacy.example.org");
      },
    );
  });
});
