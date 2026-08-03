import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  jobRequiresLocalEngine,
  isEngineOfflineError,
  ENGINE_REQUIRED_JOB_TYPES,
} from "./engine-deferred-jobs";

describe("Maschinenraum deferred jobs", () => {
  it("marks local-context ai_run jobs as Maschinenraum-required", () => {
    assert.ok(
      jobRequiresLocalEngine({
        type: "ai_run",
        payload: { actionId: "session_recap", worldSlug: "terra", pageSlug: "test" },
      }),
    );
  });

  it("does not require Maschinenraum for mail_send jobs", () => {
    assert.equal(
      jobRequiresLocalEngine({
        type: "mail_send",
        payload: { to: "player@example.com" },
      }),
      false,
    );
  });

  it("requires Maschinenraum for embedding and reindex", () => {
    assert.ok(ENGINE_REQUIRED_JOB_TYPES.has("embedding"));
    assert.ok(ENGINE_REQUIRED_JOB_TYPES.has("reindex"));
    assert.ok(jobRequiresLocalEngine({ type: "reindex", payload: { worldSlug: "terra" } }));
  });

  it("detects Maschinenraum offline error messages", () => {
    assert.ok(isEngineOfflineError("Maschinenraum offline"));
    assert.ok(isEngineOfflineError("Lokale Maschinenraum-Inference ist nicht erreichbar"));
    assert.equal(isEngineOfflineError("Unbekannter Fehler"), false);
  });
});
