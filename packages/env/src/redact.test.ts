import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redactError, redactSecrets } from "./redact";

function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void,
): void {
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
    fn();
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

describe("redactSecrets", () => {
  it("removes known ENV values from logs", () => {
    withEnv(
      {
        SESSION_SECRET: "super-secret-session-value-123456",
        UWE_SETUP_TOKEN: "setup-token-value-abcdef",
        STUDIO_API_TOKEN: "studio-token-value-ghijkl",
      },
      () => {
        const input =
          "Login failed with SESSION_SECRET=super-secret-session-value-123456 and setup-token-value-abcdef";
        const output = redactSecrets(input, process.env);

        assert.doesNotMatch(output, /super-secret-session-value-123456/);
        assert.doesNotMatch(output, /setup-token-value-abcdef/);
        assert.match(output, /\[REDACTED\]/);
      },
    );
  });

  it("redacts bearer tokens and password patterns", () => {
    const output = redactSecrets("Auth failed: password=super-secret bearer abc.def.ghi");
    assert.doesNotMatch(output, /super-secret/);
    assert.doesNotMatch(output, /abc\.def\.ghi/);
  });

  it("redacts error messages without leaking env values", () => {
    withEnv(
      {
        RTX_SERVICE_TOKEN: "rtx-service-token-9876543210",
      },
      () => {
        const error = new Error("Request failed: rtx-service-token-9876543210");
        const redacted = redactError(error, process.env);
        assert.doesNotMatch(redacted.message, /rtx-service-token-9876543210/);
      },
    );
  });
});
