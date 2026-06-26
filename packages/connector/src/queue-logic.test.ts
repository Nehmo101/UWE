import assert from "node:assert/strict";
import { test } from "node:test";

import type { ConnectorJobType } from "./job-types";
import {
  canClaimJob,
  defaultExpiryForJobType,
  deriveConnectorStatus,
  isConnectorOnline,
  isJobExpired,
  selectNextJob,
  type ClaimableJobView,
  type ClaimContext,
} from "./queue-logic";
import { CONNECTOR_JOB_DESCRIPTORS } from "./job-types";

function job(
  id: string,
  type: ConnectorJobType,
  overrides: Partial<ClaimableJobView> = {},
): ClaimableJobView {
  const descriptor = CONNECTOR_JOB_DESCRIPTORS[type];
  return {
    id,
    type,
    priority: descriptor.priority,
    lane: descriptor.lane,
    targetCapability: descriptor.capability,
    targetConnectorId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

test("deriveConnectorStatus reflects heartbeat, disabled and error states", () => {
  const now = new Date("2026-01-01T00:01:00Z");
  assert.equal(
    deriveConnectorStatus({ lastHeartbeatAt: null, queueEnabled: true, disabled: false }, now),
    "offline",
  );
  assert.equal(
    deriveConnectorStatus({ lastHeartbeatAt: now, queueEnabled: true, disabled: true }, now),
    "disabled",
  );
  assert.equal(
    deriveConnectorStatus(
      { lastHeartbeatAt: new Date(now.getTime() - 5_000), queueEnabled: true, disabled: false },
      now,
    ),
    "online",
  );
  assert.equal(
    deriveConnectorStatus(
      { lastHeartbeatAt: new Date(now.getTime() - 5_000), queueEnabled: true, disabled: false, lastError: "boom" },
      now,
    ),
    "degraded",
  );
  assert.equal(
    deriveConnectorStatus(
      { lastHeartbeatAt: new Date(now.getTime() - 120_000), queueEnabled: true, disabled: false },
      now,
    ),
    "offline",
  );
});

test("isConnectorOnline treats degraded as still reachable", () => {
  const now = new Date("2026-01-01T00:01:00Z");
  assert.equal(
    isConnectorOnline(
      { lastHeartbeatAt: new Date(now.getTime() - 1000), queueEnabled: true, disabled: false, lastError: "x" },
      now,
    ),
    true,
  );
  assert.equal(
    isConnectorOnline({ lastHeartbeatAt: null, queueEnabled: true, disabled: false }, now),
    false,
  );
});

test("canClaimJob enforces capability, lane availability and connector targeting", () => {
  const ctx: ClaimContext = {
    connectorId: "c1",
    capabilities: ["audio_local", "llm_local"],
    availableLanes: ["audio", "gpu"],
  };
  assert.equal(canClaimJob(job("a", "sound_play"), ctx), true);
  // spotify capability missing
  assert.equal(canClaimJob(job("b", "spotify_play"), ctx), false);
  // image_generation capability missing
  assert.equal(canClaimJob(job("c", "image_generate"), ctx), false);
  // targeted at another connector
  assert.equal(canClaimJob(job("d", "sound_play", { targetConnectorId: "other" }), ctx), false);
  // targeted at us
  assert.equal(canClaimJob(job("e", "sound_play", { targetConnectorId: "c1" }), ctx), true);
});

test("selectNextJob prefers higher priority then oldest", () => {
  const ctx: ClaimContext = {
    connectorId: "c1",
    capabilities: ["audio_local", "llm_local"],
    availableLanes: ["audio", "gpu"],
  };
  const older = new Date("2026-01-01T00:00:00Z");
  const newer = new Date("2026-01-01T00:00:30Z");
  const pending = [
    job("llm", "llm_generate", { createdAt: older }),
    job("play-new", "sound_play", { createdAt: newer }),
    job("play-old", "sound_play", { createdAt: older }),
    job("stop", "sound_stop", { createdAt: newer }),
  ];
  // sound_stop has priority 100 → wins over everything
  assert.equal(selectNextJob(pending, ctx)?.id, "stop");
});

test("audio job is claimable while a GPU job occupies the gpu lane", () => {
  // gpu lane busy → only audio lane free
  const ctx: ClaimContext = {
    connectorId: "c1",
    capabilities: ["audio_local", "llm_local"],
    availableLanes: ["audio"],
  };
  const pending = [
    job("llm", "llm_generate"),
    job("play", "sound_play"),
  ];
  const next = selectNextJob(pending, ctx);
  assert.equal(next?.id, "play", "audio overtakes the queued GPU job");
});

test("job expiry helpers", () => {
  const from = new Date("2026-01-01T00:00:00Z");
  const audioExpiry = defaultExpiryForJobType("sound_play", from);
  const gpuExpiry = defaultExpiryForJobType("llm_generate", from);
  assert.ok(gpuExpiry.getTime() > audioExpiry.getTime(), "gpu jobs get a longer ttl");
  assert.equal(isJobExpired(audioExpiry, new Date(from.getTime() + 60_000)), true);
  assert.equal(isJobExpired(audioExpiry, from), false);
  assert.equal(isJobExpired(null, from), false);
});
