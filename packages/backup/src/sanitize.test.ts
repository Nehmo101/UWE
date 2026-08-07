import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findSecretIssuesInJson, sanitizeRecord } from "./sanitize";

describe("recursive backup sanitizing", () => {
  it("removes secret fields from objects nested inside arrays", () => {
    const sanitized = sanitizeRecord({
      metadata: {
        sections: [
          { title: "Öffentlich", secret: "darf-nicht-ins-backup" },
          { title: "Weiterhin da", details: [{ token: "auch-nicht", note: "bleibt" }] },
        ],
      },
    });

    assert.deepEqual(sanitized, {
      metadata: {
        sections: [
          { title: "Öffentlich" },
          { title: "Weiterhin da", details: [{ note: "bleibt" }] },
        ],
      },
    });
    assert.deepEqual(findSecretIssuesInJson(JSON.stringify(sanitized)), []);
  });

  it("distinguishes a legitimate enum value from a forbidden field name", () => {
    assert.deepEqual(findSecretIssuesInJson(JSON.stringify({ type: "secret" })), []);
    assert.deepEqual(findSecretIssuesInJson(JSON.stringify({ secret: "hidden" })), [
      "Enthält verbotenes Feld: secret",
    ]);
  });
});
