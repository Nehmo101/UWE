import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  jobRequiresLocalRtx,
  isRtxOfflineError,
  RTX_REQUIRED_JOB_TYPES,
} from "./rtx-deferred-jobs";

describe("RTX deferred jobs", () => {
  it("marks local-context ai_run jobs as RTX-required", () => {
    assert.ok(
      jobRequiresLocalRtx({
        type: "ai_run",
        payload: { actionId: "session_recap", worldSlug: "terra", pageSlug: "test" },
      }),
    );
  });

  it("does not require RTX for mail_send jobs", () => {
    assert.equal(
      jobRequiresLocalRtx({
        type: "mail_send",
        payload: { to: "player@example.com" },
      }),
      false,
    );
  });

  it("requires RTX for embedding and reindex", () => {
    assert.ok(RTX_REQUIRED_JOB_TYPES.has("embedding"));
    assert.ok(RTX_REQUIRED_JOB_TYPES.has("reindex"));
    assert.ok(jobRequiresLocalRtx({ type: "reindex", payload: { worldSlug: "terra" } }));
  });

  it("detects RTX offline error messages", () => {
    assert.ok(isRtxOfflineError("RTX offline"));
    assert.ok(isRtxOfflineError("Lokale RTX-Inference ist nicht erreichbar"));
    assert.equal(isRtxOfflineError("Unbekannter Fehler"), false);
  });
});
